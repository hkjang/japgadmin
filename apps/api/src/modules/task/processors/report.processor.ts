import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';
import { ConnectionManagerService } from '../../core/services/connection-manager.service';
import { TaskStatus } from '@prisma/client';

interface ReportJobData {
  taskId: string;
  instanceId: string;
  payload: {
    reportType: 'performance' | 'health' | 'capacity' | 'activity';
    startDate?: string;
    endDate?: string;
    format?: 'json' | 'csv' | 'pdf';
  };
}

@Processor('maintenance')
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionManager: ConnectionManagerService,
  ) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<any> {
    if (job.name === 'report_generation') {
      return this.handleReportGeneration(job);
    }
    return null;
  }

  async handleReportGeneration(job: Job<ReportJobData>): Promise<any> {
    const { taskId, instanceId, payload } = job.data;

    this.logger.log(`Generating ${payload.reportType} report for instance ${instanceId}`);

    try {
      await this.updateTaskStatus(taskId, TaskStatus.RUNNING);

      let reportData: any;

      switch (payload.reportType) {
        case 'performance':
          reportData = await this.generatePerformanceReport(instanceId, payload);
          break;
        case 'health':
          reportData = await this.generateHealthReport(instanceId);
          break;
        case 'capacity':
          reportData = await this.generateCapacityReport(instanceId);
          break;
        case 'activity':
          reportData = await this.generateActivityReport(instanceId, payload);
          break;
        default:
          throw new Error(`Unknown report type: ${payload.reportType}`);
      }

      const result = {
        success: true,
        reportType: payload.reportType,
        data: reportData,
        generatedAt: new Date().toISOString(),
        format: payload.format || 'json',
      };

      await this.updateTaskResult(taskId, TaskStatus.COMPLETED, result);

      this.logger.log(`Report generation task ${taskId} completed`);

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
    this.logger.debug(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`);
  }

  private async generatePerformanceReport(
    instanceId: string,
    payload: ReportJobData['payload'],
  ): Promise<any> {
    // 메트릭 데이터 조회
    const metrics = await this.prisma.metric.findMany({
      where: {
        instanceId,
        timestamp: {
          gte: payload.startDate ? new Date(payload.startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000),
          lte: payload.endDate ? new Date(payload.endDate) : new Date(),
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // 쿼리 통계
    const queryStats = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        calls,
        total_exec_time,
        mean_exec_time,
        rows,
        query
      FROM pg_stat_statements
      ORDER BY total_exec_time DESC
      LIMIT 20`,
    );

    // 테이블별 접근 통계
    const tableStats = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        schemaname,
        relname,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        n_tup_ins,
        n_tup_upd,
        n_tup_del
      FROM pg_stat_user_tables
      ORDER BY seq_tup_read + idx_tup_fetch DESC
      LIMIT 20`,
    );

    return {
      summary: {
        period: {
          start: payload.startDate,
          end: payload.endDate,
        },
        totalMetrics: metrics.length,
      },
      metrics: this.aggregateMetrics(metrics),
      topQueries: queryStats.rows,
      tableAccess: tableStats.rows,
    };
  }

  private async generateHealthReport(instanceId: string): Promise<any> {
    // 데이터베이스 상태
    const dbStats = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        pg_database_size(current_database()) as db_size,
        (SELECT count(*) FROM pg_stat_activity) as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as running_queries,
        (SELECT count(*) FROM pg_stat_activity WHERE wait_event IS NOT NULL) as waiting_queries,
        (SELECT count(*) FROM pg_locks WHERE granted = false) as blocked_queries`,
    );

    // 테이블 팽창 (bloat) 체크
    const bloatCheck = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        schemaname || '.' || relname as table_name,
        n_dead_tup,
        n_live_tup,
        CASE WHEN n_live_tup > 0
          THEN round(100.0 * n_dead_tup / n_live_tup, 2)
          ELSE 0
        END as dead_ratio,
        last_vacuum,
        last_autovacuum
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 1000
      ORDER BY n_dead_tup DESC
      LIMIT 20`,
    );

    // 인덱스 사용률
    const indexUsage = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        schemaname || '.' || relname as table_name,
        indexrelname as index_name,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch,
        pg_relation_size(indexrelid) as index_size
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
        AND pg_relation_size(indexrelid) > 1048576
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 20`,
    );

    // 복제 상태 (있을 경우)
    let replicationStatus = null;
    try {
      const replResult = await this.connectionManager.executeQuery(
        instanceId,
        `SELECT
          client_addr,
          state,
          sent_lsn,
          write_lsn,
          flush_lsn,
          replay_lsn,
          sync_state
        FROM pg_stat_replication`,
      );
      replicationStatus = replResult.rows;
    } catch {
      // 복제 설정이 없을 수 있음
    }

    return {
      database: dbStats.rows[0],
      tableBloat: bloatCheck.rows,
      unusedIndexes: indexUsage.rows,
      replication: replicationStatus,
      generatedAt: new Date().toISOString(),
    };
  }

  private async generateCapacityReport(instanceId: string): Promise<any> {
    // 데이터베이스 크기
    const dbSizes = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        datname,
        pg_database_size(datname) as size_bytes,
        pg_size_pretty(pg_database_size(datname)) as size_pretty
      FROM pg_database
      WHERE datname NOT IN ('template0', 'template1')
      ORDER BY pg_database_size(datname) DESC`,
    );

    // 테이블 크기
    const tableSizes = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        schemaname || '.' || relname as table_name,
        pg_total_relation_size(relid) as total_size,
        pg_relation_size(relid) as table_size,
        pg_indexes_size(relid) as indexes_size,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size_pretty,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 30`,
    );

    // 테이블스페이스 사용량
    const tablespaceSizes = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        spcname,
        pg_tablespace_size(oid) as size_bytes,
        pg_size_pretty(pg_tablespace_size(oid)) as size_pretty
      FROM pg_tablespace
      ORDER BY pg_tablespace_size(oid) DESC`,
    );

    // 히스토리 기반 성장 추이 (최근 30일)
    const growthTrend = await this.prisma.metric.findMany({
      where: {
        instanceId,
        metricType: 'database',
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        data: true,
      },
    });

    return {
      databases: dbSizes.rows,
      tables: tableSizes.rows,
      tablespaces: tablespaceSizes.rows,
      growthTrend: growthTrend.map((m) => ({
        timestamp: m.timestamp,
        sizeBytes: (m.data as any)?.totalSize || 0,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private async generateActivityReport(
    instanceId: string,
    payload: ReportJobData['payload'],
  ): Promise<any> {
    // 쿼리 히스토리
    const queryHistory = await this.prisma.queryHistory.findMany({
      where: {
        instanceId,
        startTime: {
          gte: payload.startDate ? new Date(payload.startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000),
          lte: payload.endDate ? new Date(payload.endDate) : new Date(),
        },
      },
      orderBy: { startTime: 'desc' },
      take: 100,
    });

    // 사용자별 활동
    const userActivity = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        usename,
        count(*) as connection_count,
        count(*) FILTER (WHERE state = 'active') as active_count,
        count(*) FILTER (WHERE state = 'idle') as idle_count,
        max(backend_start) as last_connection
      FROM pg_stat_activity
      WHERE usename IS NOT NULL
      GROUP BY usename
      ORDER BY connection_count DESC`,
    );

    // 시간대별 쿼리 분포
    const hourlyDistribution = await this.prisma.$queryRaw`
      SELECT
        date_trunc('hour', "startTime") as hour,
        count(*) as query_count,
        avg("durationMs") as avg_duration,
        max("durationMs") as max_duration
      FROM "QueryHistory"
      WHERE "instanceId" = ${instanceId}
        AND "startTime" >= ${payload.startDate ? new Date(payload.startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000)}
      GROUP BY date_trunc('hour', "startTime")
      ORDER BY hour
    `;

    return {
      period: {
        start: payload.startDate,
        end: payload.endDate,
      },
      queryHistory: queryHistory.slice(0, 50),
      userActivity: userActivity.rows,
      hourlyDistribution,
      summary: {
        totalQueries: queryHistory.length,
        avgDuration:
          queryHistory.length > 0
            ? queryHistory.reduce((sum, q) => sum + (q.durationMs || 0), 0) / queryHistory.length
            : 0,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private aggregateMetrics(metrics: any[]): Record<string, any> {
    if (metrics.length === 0) {
      return {};
    }

    const grouped = metrics.reduce((acc, m) => {
      if (!acc[m.metricType]) {
        acc[m.metricType] = [];
      }
      acc[m.metricType].push(m);
      return acc;
    }, {} as Record<string, any[]>);

    return Object.entries(grouped).reduce((acc, [type, items]) => {
      const typedItems = items as any[];
      acc[type] = {
        count: typedItems.length,
        samples: typedItems.slice(-10).map((i: any) => ({
          timestamp: i.timestamp,
          data: i.data,
        })),
      };
      return acc;
    }, {} as Record<string, any>);
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
