import { Injectable, BadRequestException } from '@nestjs/common';
import { TaskService } from '../task/task.service';
import { TaskType } from '@prisma/client';

export interface CreateRetentionPolicyDto {
  instanceId: string;
  schema?: string;
  table: string;
  dateColumn: string;
  retentionDays: number;
  cronExpression: string; // e.g. "0 0 * * *" (daily at midnight)
  dryRun?: boolean;
}

@Injectable()
export class RetentionService {
  constructor(private readonly taskService: TaskService) {}

  async createPolicy(dto: CreateRetentionPolicyDto, userId: string): Promise<any> {
    const { instanceId, schema = 'public', table, dateColumn, retentionDays, cronExpression, dryRun } = dto;

    if (retentionDays < 1) {
      throw new BadRequestException('Retention days must be at least 1');
    }

    const payload = {
      schema,
      table,
      dateColumn,
      retentionDays,
      dryRun,
    };

    const name = `retention-${instanceId}-${schema}-${table}`;

    // Create MaintenanceSchedule using TaskService
    return this.taskService.createSchedule({
      name,
      instanceId,
      taskType: TaskType.TABLE_RETENTION,
      cronExpression,
      taskPayload: payload,
      enabled: true,
    });
  }

  async getPolicies(instanceId: string): Promise<any[]> {
    const schedules = await this.taskService.getSchedules(instanceId);
    return schedules.filter(s => s.taskType === TaskType.TABLE_RETENTION);
  }

  async deletePolicy(id: string): Promise<void> {
    const schedule = await this.taskService.getSchedule(id);
    if (schedule.taskType !== TaskType.TABLE_RETENTION) {
        throw new BadRequestException('Not a retention policy');
    }
    await this.taskService.deleteSchedule(id);
  }
}
