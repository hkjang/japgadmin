import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';
import { ConnectionManagerService } from '../../core/services/connection-manager.service';
import { TaskStatus } from '@prisma/client';

interface VacuumJobData {
  taskId: string;
  instanceId: string;
  payload: {
    database?: string;
    schema?: string;
    table?: string;
    full?: boolean;
    analyze?: boolean;
    freeze?: boolean;
    verbose?: boolean;
  };
}

@Processor('maintenance')
export class VacuumProcessor extends WorkerHost {
  private readonly logger = new Logger(VacuumProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionManager: ConnectionManagerService,
  ) {
    super();
  }

  async process(job: Job<VacuumJobData>): Promise<any> {
    switch (job.name) {
      case 'vacuum':
        return this.handleVacuum(job);
      case 'vacuum_full':
        return this.handleVacuumFull(job);
      case 'analyze':
        return this.handleAnalyze(job);
      case 'reindex':
        return this.handleReindex(job);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        return null;
    }
  }

  async handleVacuum(job: Job<VacuumJobData>): Promise<any> {
    const { taskId, instanceId, payload } = job.data;

    this.logger.log(`Processing vacuum task ${taskId} for instance ${instanceId}`);

    try {
      // 작업 시작 상태 업데이트
      await this.updateTaskStatus(taskId, TaskStatus.RUNNING);

      // VACUUM 쿼리 구성
      const vacuumQuery = this.buildVacuumQuery(payload);

      // VACUUM 실행 (타임아웃 없이, VACUUM은 오래 걸릴 수 있음)
      const startTime = Date.now();
      await this.connectionManager.executeQuery(instanceId, vacuumQuery, [], {
        timeout: 0, // 타임아웃 없음
      });
      const duration = Date.now() - startTime;

      // 성공 결과 저장
      const result = {
        success: true,
        query: vacuumQuery,
        durationMs: duration,
        completedAt: new Date().toISOString(),
      };

      await this.updateTaskResult(taskId, TaskStatus.COMPLETED, result);

      // VacuumHistory에도 기록 (기존 vacuum 모듈과 호환)
      await this.recordVacuumHistory(payload, duration);

      this.logger.log(`Vacuum task ${taskId} completed in ${duration}ms`);

      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        failedAt: new Date().toISOString(),
      };

      await this.updateTaskResult(taskId, TaskStatus.FAILED, errorResult);

      this.logger.error(`Vacuum task ${taskId} failed: ${error.message}`);
      throw error;
    }
  }

  async handleVacuumFull(job: Job<VacuumJobData>): Promise<any> {
    // VACUUM FULL은 별도 프로세스로 처리 (더 오래 걸림)
    const payload = { ...job.data.payload, full: true };
    const modifiedJob = {
      ...job,
      data: { ...job.data, payload },
    } as Job<VacuumJobData>;
    return this.handleVacuum(modifiedJob);
  }

  async handleAnalyze(job: Job<VacuumJobData>): Promise<any> {
    const { taskId, instanceId, payload } = job.data;

    this.logger.log(`Processing analyze task ${taskId} for instance ${instanceId}`);

    try {
      await this.updateTaskStatus(taskId, TaskStatus.RUNNING);

      const analyzeQuery = this.buildAnalyzeQuery(payload);

      const startTime = Date.now();
      await this.connectionManager.executeQuery(instanceId, analyzeQuery, [], {
        timeout: 0,
      });
      const duration = Date.now() - startTime;

      const result = {
        success: true,
        query: analyzeQuery,
        durationMs: duration,
        completedAt: new Date().toISOString(),
      };

      await this.updateTaskResult(taskId, TaskStatus.COMPLETED, result);

      this.logger.log(`Analyze task ${taskId} completed in ${duration}ms`);

      return result;
    } catch (error) {
      await this.updateTaskResult(taskId, TaskStatus.FAILED, {
        success: false,
        error: error.message,
      });
      throw error;
    }
  }

  async handleReindex(job: Job<VacuumJobData>): Promise<any> {
    const { taskId, instanceId, payload } = job.data;

    this.logger.log(`Processing reindex task ${taskId} for instance ${instanceId}`);

    try {
      await this.updateTaskStatus(taskId, TaskStatus.RUNNING);

      const reindexQuery = this.buildReindexQuery(payload);

      const startTime = Date.now();
      await this.connectionManager.executeQuery(instanceId, reindexQuery, [], {
        timeout: 0,
      });
      const duration = Date.now() - startTime;

      const result = {
        success: true,
        query: reindexQuery,
        durationMs: duration,
        completedAt: new Date().toISOString(),
      };

      await this.updateTaskResult(taskId, TaskStatus.COMPLETED, result);

      this.logger.log(`Reindex task ${taskId} completed in ${duration}ms`);

      return result;
    } catch (error) {
      await this.updateTaskResult(taskId, TaskStatus.FAILED, {
        success: false,
        error: error.message,
      });
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: any) {
    this.logger.debug(`Job ${job.id} completed with result: ${JSON.stringify(result)}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`);
  }

  // ============ Helper Methods ============

  private buildVacuumQuery(payload: VacuumJobData['payload']): string {
    const parts = ['VACUUM'];

    if (payload.full) {
      parts.push('FULL');
    }
    if (payload.freeze) {
      parts.push('FREEZE');
    }
    if (payload.analyze) {
      parts.push('ANALYZE');
    }
    if (payload.verbose) {
      parts.push('VERBOSE');
    }

    if (payload.schema && payload.table) {
      parts.push(`"${payload.schema}"."${payload.table}"`);
    } else if (payload.table) {
      parts.push(`"${payload.table}"`);
    }

    return parts.join(' ');
  }

  private buildAnalyzeQuery(payload: VacuumJobData['payload']): string {
    const parts = ['ANALYZE'];

    if (payload.verbose) {
      parts.push('VERBOSE');
    }

    if (payload.schema && payload.table) {
      parts.push(`"${payload.schema}"."${payload.table}"`);
    } else if (payload.table) {
      parts.push(`"${payload.table}"`);
    }

    return parts.join(' ');
  }

  private buildReindexQuery(payload: VacuumJobData['payload']): string {
    if (payload.schema && payload.table) {
      return `REINDEX TABLE "${payload.schema}"."${payload.table}"`;
    } else if (payload.table) {
      return `REINDEX TABLE "${payload.table}"`;
    } else if (payload.schema) {
      return `REINDEX SCHEMA "${payload.schema}"`;
    } else if (payload.database) {
      return `REINDEX DATABASE "${payload.database}"`;
    }

    return 'REINDEX DATABASE';
  }

  private async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        startedAt: status === TaskStatus.RUNNING ? new Date() : undefined,
      },
    });
  }

  private async updateTaskResult(taskId: string, status: TaskStatus, result: any): Promise<void> {
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        result,
        completedAt: new Date(),
      },
    });
  }

  private async recordVacuumHistory(
    payload: VacuumJobData['payload'],
    durationMs: number,
  ): Promise<void> {
    try {
      await this.prisma.vacuumHistory.create({
        data: {
          targetDb: payload.database || 'default',
          tableName: payload.table
            ? payload.schema
              ? `${payload.schema}.${payload.table}`
              : payload.table
            : 'ALL',
          vacuumType: payload.full ? 'VACUUM FULL' : payload.analyze ? 'VACUUM ANALYZE' : 'VACUUM',
          duration: durationMs,
          status: 'success',
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to record vacuum history: ${error.message}`);
    }
  }
}
