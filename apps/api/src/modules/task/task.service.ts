import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { TaskStatus, TaskType, TaskPriority } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface CreateTaskDto {
  type: TaskType;
  instanceId: string;
  payload?: Record<string, any>;
  priority?: TaskPriority;
  scheduledAt?: Date;
  scheduleId?: string;
}

export interface CreateScheduleDto {
  name: string;
  instanceId: string;
  taskType: TaskType;
  cronExpression: string;
  taskPayload?: Record<string, any>;
  enabled?: boolean;
}

export interface UpdateScheduleDto {
  name?: string;
  cronExpression?: string;
  taskPayload?: Record<string, any>;
  enabled?: boolean;
}

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('maintenance') private readonly maintenanceQueue: Queue,
  ) {}

  // ============ Task Management ============

  async createTask(dto: CreateTaskDto, createdById?: string): Promise<any> {
    // 인스턴스 존재 확인
    const instance = await this.prisma.instance.findUnique({
      where: { id: dto.instanceId },
    });

    if (!instance) {
      throw new NotFoundException('인스턴스를 찾을 수 없습니다');
    }

    // 작업 레코드 생성
    const task = await this.prisma.task.create({
      data: {
        type: dto.type,
        status: dto.scheduledAt ? TaskStatus.PENDING : TaskStatus.QUEUED,
        priority: dto.priority || TaskPriority.NORMAL,
        instanceId: dto.instanceId,
        payload: dto.payload || {},
        scheduledAt: dto.scheduledAt,
        createdById,
        scheduleId: dto.scheduleId,
      },
    });

    // 즉시 실행이면 큐에 추가
    if (!dto.scheduledAt) {
      await this.enqueueTask(task);
    }

    return task;
  }

  async enqueueTask(task: any): Promise<Job> {
    const priorityMap = {
      [TaskPriority.LOW]: 10,
      [TaskPriority.NORMAL]: 5,
      [TaskPriority.HIGH]: 2,
      [TaskPriority.CRITICAL]: 1,
    };

    const job = await this.maintenanceQueue.add(
      task.type.toLowerCase(),
      {
        taskId: task.id,
        instanceId: task.instanceId,
        payload: task.payload,
      },
      {
        jobId: task.id,
        priority: priorityMap[task.priority] || 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    // 상태 업데이트
    await this.prisma.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.QUEUED },
    });

    return job;
  }

  async getTasks(filters: {
    instanceId?: string;
    type?: TaskType;
    status?: TaskStatus;
    scheduleId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ tasks: any[]; total: number }> {
    const where: any = {};

    if (filters.instanceId) {
      where.instanceId = filters.instanceId;
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.scheduleId) {
      where.scheduleId = filters.scheduleId;
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          instance: {
            select: {
              id: true,
              name: true,
              host: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.task.count({ where }),
    ]);

    return { tasks, total };
  }

  async getTask(id: string): Promise<any> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        instance: true,
      },
    });

    if (!task) {
      throw new NotFoundException('작업을 찾을 수 없습니다');
    }

    // 큐 작업 정보도 함께 조회
    let jobInfo = null;
    try {
      const job = await this.maintenanceQueue.getJob(id);
      if (job) {
        jobInfo = {
          state: await job.getState(),
          progress: job.progress,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
        };
      }
    } catch (error) {
      this.logger.warn(`Failed to get job info for task ${id}: ${error.message}`);
    }

    return { ...task, jobInfo };
  }

  async cancelTask(id: string): Promise<any> {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('작업을 찾을 수 없습니다');
    }

    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
      throw new BadRequestException('이미 완료되거나 실패한 작업은 취소할 수 없습니다');
    }

    // 큐에서 작업 제거 시도
    try {
      const job = await this.maintenanceQueue.getJob(id);
      if (job) {
        await job.remove();
      }
    } catch (error) {
      this.logger.warn(`Failed to remove job from queue: ${error.message}`);
    }

    // 상태 업데이트
    return this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.CANCELLED,
        completedAt: new Date(),
      },
    });
  }

  async retryTask(id: string): Promise<any> {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException('작업을 찾을 수 없습니다');
    }

    if (task.status !== TaskStatus.FAILED) {
      throw new BadRequestException('실패한 작업만 재시도할 수 있습니다');
    }

    // 새 작업 생성
    return this.createTask({
      type: task.type,
      instanceId: task.instanceId!,
      payload: task.payload as Record<string, any>,
      priority: task.priority,
    });
  }

  // ============ Queue Statistics ============

  async getQueueStats(): Promise<any> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.maintenanceQueue.getWaitingCount(),
      this.maintenanceQueue.getActiveCount(),
      this.maintenanceQueue.getCompletedCount(),
      this.maintenanceQueue.getFailedCount(),
      this.maintenanceQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
    };
  }

  async getActiveJobs(): Promise<any[]> {
    const jobs = await this.maintenanceQueue.getActive();
    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
    }));
  }

  async getFailedJobs(limit: number = 20): Promise<any[]> {
    const jobs = await this.maintenanceQueue.getFailed(0, limit - 1);
    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
    }));
  }

  // ============ Maintenance Schedule ============

  async createSchedule(dto: CreateScheduleDto): Promise<any> {
    // 인스턴스 존재 확인
    const instance = await this.prisma.instance.findUnique({
      where: { id: dto.instanceId },
    });

    if (!instance) {
      throw new NotFoundException('인스턴스를 찾을 수 없습니다');
    }

    // cron 표현식 유효성 검사
    if (!this.isValidCronExpression(dto.cronExpression)) {
      throw new BadRequestException('유효하지 않은 cron 표현식입니다');
    }

    return this.prisma.maintenanceSchedule.create({
      data: {
        name: dto.name,
        instanceId: dto.instanceId,
        taskType: dto.taskType,
        cronExpression: dto.cronExpression,
        taskPayload: dto.taskPayload || {},
        enabled: dto.enabled ?? true,
      },
    });
  }

  async getSchedules(instanceId?: string): Promise<any[]> {
    const where = instanceId ? { instanceId } : {};

    return this.prisma.maintenanceSchedule.findMany({
      where,
      include: {
        instance: {
          select: {
            id: true,
            name: true,
            host: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSchedule(id: string): Promise<any> {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: {
        instance: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('스케줄을 찾을 수 없습니다');
    }

    return schedule;
  }

  async updateSchedule(id: string, dto: UpdateScheduleDto): Promise<any> {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException('스케줄을 찾을 수 없습니다');
    }

    if (dto.cronExpression && !this.isValidCronExpression(dto.cronExpression)) {
      throw new BadRequestException('유효하지 않은 cron 표현식입니다');
    }

    return this.prisma.maintenanceSchedule.update({
      where: { id },
      data: {
        name: dto.name,
        cronExpression: dto.cronExpression,
        taskPayload: dto.taskPayload,
        enabled: dto.enabled,
      },
    });
  }

  async deleteSchedule(id: string): Promise<void> {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException('스케줄을 찾을 수 없습니다');
    }

    await this.prisma.maintenanceSchedule.delete({
      where: { id },
    });
  }

  async toggleSchedule(id: string): Promise<any> {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException('스케줄을 찾을 수 없습니다');
    }

    return this.prisma.maintenanceSchedule.update({
      where: { id },
      data: { enabled: !schedule.enabled },
    });
  }

  // ============ Scheduled Task Execution ============

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledTasks(): Promise<void> {
    // 예약된 작업 중 실행 시간이 된 것들 처리
    const pendingTasks = await this.prisma.task.findMany({
      where: {
        status: TaskStatus.PENDING,
        scheduledAt: {
          lte: new Date(),
        },
      },
    });

    for (const task of pendingTasks) {
      try {
        await this.enqueueTask(task);
        this.logger.log(`Scheduled task ${task.id} enqueued`);
      } catch (error) {
        this.logger.error(`Failed to enqueue scheduled task ${task.id}: ${error.message}`);
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkMaintenanceSchedules(): Promise<void> {
    const schedules = await this.prisma.maintenanceSchedule.findMany({
      where: { enabled: true },
    });

    const now = new Date();

    for (const schedule of schedules) {
      if (this.shouldRunNow(schedule.cronExpression, schedule.lastRunAt, now)) {
        try {
          await this.createTask({
             type: schedule.taskType,
            instanceId: schedule.instanceId!,
            payload: schedule.taskPayload as Record<string, any>,
            scheduleId: schedule.id,
          });

          await this.prisma.maintenanceSchedule.update({
            where: { id: schedule.id },
            data: { lastRunAt: now },
          });

          this.logger.log(`Maintenance schedule ${schedule.name} triggered`);
        } catch (error) {
          this.logger.error(
            `Failed to trigger maintenance schedule ${schedule.name}: ${error.message}`,
          );
        }
      }
    }
  }

  // ============ Helper Methods ============

  private isValidCronExpression(expression: string): boolean {
    // 간단한 cron 표현식 유효성 검사
    const parts = expression.split(' ');
    if (parts.length < 5 || parts.length > 6) {
      return false;
    }
    return true;
  }

  private shouldRunNow(cronExpression: string, lastRunAt: Date | null, now: Date): boolean {
    // 간단한 cron 매칭 로직 (실제로는 node-cron 라이브러리 사용 권장)
    // 분 단위로만 체크 (마지막 실행 후 1분 이상 경과)
    if (lastRunAt) {
      const diffMs = now.getTime() - lastRunAt.getTime();
      if (diffMs < 60000) {
        return false;
      }
    }

    const parts = cronExpression.split(' ');
    const minute = parseInt(parts[0], 10);
    const hour = parseInt(parts[1], 10);

    // * 처리
    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();

    const minuteMatch = parts[0] === '*' || minute === currentMinute;
    const hourMatch = parts[1] === '*' || hour === currentHour;

    return minuteMatch && hourMatch;
  }

  // ============ Task History Cleanup ============

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldTasks(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.prisma.task.deleteMany({
      where: {
        status: {
          in: [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED],
        },
        completedAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} old tasks`);
    }
  }
}
