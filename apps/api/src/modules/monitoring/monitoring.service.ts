import { Injectable } from '@nestjs/common';
import { PostgresService } from '../../database/postgres.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MonitoringService {
  constructor(
    private readonly postgresService: PostgresService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * pg_stat_activity 조회
   * 현재 실행 중인 쿼리와 연결 정보
   */
  async getActivity(limit: number = 100) {
    const query = `
      SELECT 
        pid,
        usename,
        application_name,
        client_addr,
        state,
        wait_event_type,
        wait_event,
        query,
        query_start,
        state_change,
        EXTRACT(EPOCH FROM (now() - query_start)) * 1000 as duration_ms
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid != pg_backend_pid()
      ORDER BY query_start DESC
      LIMIT $1
    `;
    
    const result = await this.postgresService.query(query, [limit]);
    
    // 메트릭 저장
    await this.saveMetric('activity', result.rows);
    
    return {
      timestamp: new Date(),
      count: result.rowCount,
      data: result.rows,
    };
  }

  /**
   * pg_stat_database 조회
   * 데이터베이스 전체 통계
   */
  async getDatabaseStats() {
    const query = `
      SELECT 
        datname,
        numbackends as active_connections,
        xact_commit as committed_transactions,
        xact_rollback as rolled_back_transactions,
        blks_read,
        blks_hit,
        CASE 
          WHEN (blks_hit + blks_read) > 0 
          THEN ROUND((blks_hit::numeric / (blks_hit + blks_read)) * 100, 2)
          ELSE 0
        END as cache_hit_ratio,
        tup_returned,
        tup_fetched,
        tup_inserted,
        tup_updated,
        tup_deleted,
        conflicts,
        temp_files,
        temp_bytes,
        deadlocks,
        stats_reset
      FROM pg_stat_database
      WHERE datname = current_database()
    `;
    
    const result = await this.postgresService.query(query);
    const stats = result.rows[0] || {};
    
    // 메트릭 저장
    await this.saveMetric('database', stats);
    
    return {
      timestamp: new Date(),
      database: stats.datname,
      stats,
    };
  }

  /**
   * Wait Event 통계
   */
  async getWaitEvents() {
    const query = `
      SELECT 
        wait_event_type,
        wait_event,
        COUNT(*) as count,
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
      FROM pg_stat_activity
      WHERE wait_event_type IS NOT NULL
        AND datname = current_database()
      GROUP BY wait_event_type, wait_event
      ORDER BY count DESC
    `;
    
    const result = await this.postgresService.query(query);
    
    // 메트릭 저장
    await this.saveMetric('wait_event', result.rows);
    
    return {
      timestamp: new Date(),
      count: result.rowCount,
      events: result.rows,
    };
  }

  /**
   * 테이블 및 인덱스 용량 분석
   */
  async getTableSizes(limit: number = 20) {
    const query = `
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_total_relation_size(schemaname||'.'||tablename) as total_bytes,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_relation_size(schemaname||'.'||tablename) as table_bytes,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - 
                       pg_relation_size(schemaname||'.'||tablename)) as index_size,
        (pg_total_relation_size(schemaname||'.'||tablename) - 
         pg_relation_size(schemaname||'.'||tablename)) as index_bytes
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT $1
    `;
    
    const result = await this.postgresService.query(query, [limit]);
    
    // 메트릭 저장
    await this.saveMetric('table_size', result.rows);
    
    return {
      timestamp: new Date(),
      count: result.rowCount,
      tables: result.rows,
    };
  }

  /**
   * Background Writer 통계
   */
  async getBgwriterStats() {
    const query = `
      SELECT 
        checkpoints_timed,
        checkpoints_req,
        checkpoint_write_time,
        checkpoint_sync_time,
        buffers_checkpoint,
        buffers_clean,
        maxwritten_clean,
        buffers_backend,
        buffers_backend_fsync,
        buffers_alloc,
        stats_reset
      FROM pg_stat_bgwriter
    `;
    
    const result = await this.postgresService.query(query);
    return {
      timestamp: new Date(),
      stats: result.rows[0] || {},
    };
  }

  /**
   * 연결 통계
   */
  async getConnectionStats() {
    const query = `
      SELECT 
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
        (SELECT COUNT(*) FROM pg_stat_activity) as total_connections,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle in transaction') as idle_in_transaction
    `;
    
    const result = await this.postgresService.query(query);
    const stats = result.rows[0] || {};
    
    return {
      timestamp: new Date(),
      connections: {
        ...stats,
        usage_percentage: ((stats.total_connections / stats.max_connections) * 100).toFixed(2),
      },
    };
  }

  /**
   * 메트릭 저장 (TimescaleDB)
   */
  private async saveMetric(metricType: string, data: any) {
    try {
      await this.prismaService.metric.create({
        data: {
          metricType,
          targetDb: process.env.TARGET_DB_NAME || 'target_db',
          data: data,
        },
      });
    } catch (error) {
      console.error(`Failed to save metric: ${metricType}`, error);
    }
  }
}
