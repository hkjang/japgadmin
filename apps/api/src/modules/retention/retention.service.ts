import { Injectable, BadRequestException } from '@nestjs/common';
import { TaskService } from '../task/task.service';
import { TaskType } from '@prisma/client';
import { ConnectionManagerService } from '../core/services/connection-manager.service';

export interface CreateRetentionPolicyDto {
  instanceId: string;
  schema?: string;
  table: string;
  dateColumn: string;
  retentionDays: number;
  cronExpression: string; // e.g. "0 0 * * *" (daily at midnight)
  dryRun?: boolean;
}

export interface UpdateRetentionPolicyDto extends Partial<CreateRetentionPolicyDto> {
  enabled?: boolean;
}

@Injectable()
export class RetentionService {
  constructor(
    private readonly taskService: TaskService,
    private readonly connectionManager: ConnectionManagerService,
  ) {}

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

  async triggerPolicy(id: string): Promise<void> {
    const schedule = await this.taskService.getSchedule(id);
    if (schedule.taskType !== TaskType.TABLE_RETENTION) {
        throw new BadRequestException('Not a retention policy');
    }
    
    // Create an immediate task based on the schedule
    await this.taskService.createTask({
        type: schedule.taskType,
        instanceId: schedule.instanceId!,
        payload: schedule.taskPayload as Record<string, any>,
    });
  }

  async updatePolicy(id: string, dto: UpdateRetentionPolicyDto): Promise<any> {
    const schedule = await this.taskService.getSchedule(id);
    if (schedule.taskType !== TaskType.TABLE_RETENTION) {
        throw new BadRequestException('Not a retention policy');
    }

    const payload = {
        ...schedule.taskPayload as any,
        ...(dto.schema && { schema: dto.schema }),
        ...(dto.table && { table: dto.table }),
        ...(dto.dateColumn && { dateColumn: dto.dateColumn }),
        ...(dto.retentionDays && { retentionDays: dto.retentionDays }),
        ...(dto.dryRun !== undefined && { dryRun: dto.dryRun }),
    };

    // Construct new name if identifying fields change
    let name = schedule.name;
    if (dto.instanceId || dto.schema || dto.table) {
         // Note: instanceId usually doesn't change for a schedule easily, but schema/table might
         const iId = dto.instanceId || schedule.instanceId;
         const sch = dto.schema || (schedule.taskPayload as any).schema;
         const tbl = dto.table || (schedule.taskPayload as any).table;
         name = `retention-${iId}-${sch}-${tbl}`;
    }

    return this.taskService.updateSchedule(id, {
        name,
        cronExpression: dto.cronExpression,
        taskPayload: payload,
        enabled: dto.enabled,
    });
  }


  async simulatePolicy(id: string): Promise<{ rowCount: number; query: string }> {
     const schedule = await this.taskService.getSchedule(id);
     if (schedule.taskType !== TaskType.TABLE_RETENTION) {
         throw new BadRequestException('Not a retention policy');
     }

     const payload = schedule.taskPayload as any;
     const { schema, table, dateColumn, retentionDays } = payload;
     
     if (!schema || !table || !dateColumn || !retentionDays) {
         throw new BadRequestException('Invalid policy configuration');
     }

     // Construct Count Query (Safe simulation)
     // Use parameterized query structure if possible or direct interpolation carefully sanitized or relying on user input trust for internal tools
     // Since schema/table/column are selected from dropdowns (IDs ideally, but names here), we assume some safety but should quote identifiers
     
     const query = `
       SELECT COUNT(*) as count 
       FROM "${schema}"."${table}" 
       WHERE "${dateColumn}" < NOW() - INTERVAL '${retentionDays} days'
     `;

     try {
        const result = await this.connectionManager.queryOne<{ count: string | number }>(
            schedule.instanceId,
            query
        );
        return { 
            rowCount: Number(result?.count || 0), 
            query 
        };
     } catch (error) {
         throw new BadRequestException(`Simulation failed: ${error.message}`);
     }
  }

  async getPolicyHistory(id: string): Promise<any[]> {
      const { tasks } = await this.taskService.getTasks({
          scheduleId: id,
          limit: 10,
      });
      return tasks;
  }
}
