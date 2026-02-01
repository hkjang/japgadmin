import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';
import { ConnectionManagerService } from '../../core/services/connection-manager.service';
import { TaskStatus } from '@prisma/client';

interface RetentionJobData {
  taskId: string;
  instanceId: string;
  payload: {
    schema?: string;
    table: string;
    dateColumn: string;
    retentionDays: number;
    dryRun?: boolean;
  };
}

@Processor('maintenance')
export class RetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(RetentionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionManager: ConnectionManagerService,
  ) {
    super();
  }

  async process(job: Job<RetentionJobData>): Promise<any> {
    if (job.name === 'table_retention') {
      return this.handleRetention(job);
    }
    return null;
  }

  async handleRetention(job: Job<RetentionJobData>): Promise<any> {
    const { taskId, instanceId, payload } = job.data;
    const { schema = 'public', table, dateColumn, retentionDays } = payload;

    this.logger.log(`Processing retention task ${taskId} for ${schema}.${table}`);

    try {
      await this.updateTaskStatus(taskId, TaskStatus.RUNNING);

      // Calculate cutoff date
      const cutoffQuery = `SELECT NOW() - INTERVAL '${retentionDays} days' as cutoff`;
      const cutoffResult = await this.connectionManager.executeQuery(instanceId, cutoffQuery);
      const cutoffDate = cutoffResult.rows[0]?.cutoff;

      // Construct DELETE query
      // Safety: We might want to limit the delete size in the future, but for now simple DELETE
      const deleteQuery = `
        DELETE FROM "${schema}"."${table}"
        WHERE "${dateColumn}" < $1
      `;
      
      this.logger.log(`Executing retention delete on ${schema}.${table} older than ${cutoffDate}`);

      const startTime = Date.now();
      const result = await this.connectionManager.executeQuery(
        instanceId, 
        deleteQuery, 
        [cutoffDate],
        { timeout: 0 } // Long running operation
      );
      const duration = Date.now() - startTime;

      const deletedCount = result.rowCount || 0;

      const taskResult = {
        success: true,
        deletedCount,
        cutoffDate,
        durationMs: duration,
        completedAt: new Date().toISOString(),
      };

      await this.updateTaskResult(taskId, TaskStatus.COMPLETED, taskResult);
      
      this.logger.log(`Retention task ${taskId} deleted ${deletedCount} rows in ${duration}ms`);

      return taskResult;

    } catch (error) {
       const errorResult = {
        success: false,
        error: error.message,
        failedAt: new Date().toISOString(),
      };

      await this.updateTaskResult(taskId, TaskStatus.FAILED, errorResult);
      this.logger.error(`Retention task ${taskId} failed: ${error.message}`);
      throw error;
    }
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
}
