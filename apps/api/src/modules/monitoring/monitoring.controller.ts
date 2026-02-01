import { Controller, Get, Query } from '@nestjs/common';
import { PostgresService } from '../../database/postgres.service';
import { PrismaService } from '../../database/prisma.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly postgresService: PostgresService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('activity')
  async getActivity() {
    const query = `
      SELECT 
        pid,
        usename,
        application_name,
        client_addr,
        state,
        query,
        state_change,
        EXTRACT(EPOCH FROM (NOW() - state_change)) as duration_seconds
      FROM pg_stat_activity
      WHERE state != 'idle'
      ORDER BY state_change;
    `;
    const result = await this.postgresService.query(query);
    return { activity: result.rows };
  }

  @Get('database')
  async getDatabaseStats() {
    const query = `
      SELECT 
        numbackends,
        xact_commit,
        xact_rollback,
        blks_read,
        blks_hit,
        tup_returned,
        tup_fetched,
        tup_inserted,
        tup_updated,
        tup_deleted,
        deadlocks
      FROM pg_stat_database
      WHERE datname = current_database();
    `;
    const result = await this.postgresService.query(query);
    return { data: result.rows[0] || {} };
  }

  @Get('wait-events')
  async getWaitEvents() {
    const query = `
      SELECT 
        wait_event_type,
        wait_event,
        COUNT(*) as count
      FROM pg_stat_activity
      WHERE wait_event IS NOT NULL
      GROUP BY wait_event_type, wait_event
      ORDER BY count DESC;
    `;
    const result = await this.postgresService.query(query);
    return { waitEvents: result.rows };
  }

  @Get('table-sizes')
  async getTableSizes() {
    const query = `
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename))) AS size,
        pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename)) AS size_bytes,
        pg_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename)) AS table_bytes,
        (pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename)) -
         pg_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename))) AS index_bytes
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY size_bytes DESC
      LIMIT 10;
    `;
    const result = await this.postgresService.query(query);
    return { tableSizes: result.rows };
  }

  @Get('bgwriter')
  async getBgwriterStats() {
    const query = `SELECT * FROM pg_stat_bgwriter;`;
    const result = await this.postgresService.query(query);
    return { data: result.rows[0] || {} };
  }

  @Get('connection-stats')
  async getConnectionStats() {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE state = 'active') as active_connections,
        COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
        COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
        COUNT(*) as total_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
        ROUND(100.0 * COUNT(*) / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'), 2) as usage_percentage
      FROM pg_stat_activity;
    `;
    const result = await this.postgresService.query(query);
    return { connections: result.rows[0] || {} };
  }

  @Get('txid-wraparound')
  async getTxidWraparound() {
    const query = `
      SELECT 
        datname,
        age(datfrozenxid) as xid_age,
        2000000000 - age(datfrozenxid) as xids_remaining,
        ROUND(100.0 * age(datfrozenxid) / 2000000000, 2) as percent_towards_wraparound
      FROM pg_database
      WHERE datname = current_database();
    `;
    const result = await this.postgresService.query(query);
    return { data: result.rows[0] || {} };
  }

  @Get('locks')
  async getLocks() {
    const query = `
      SELECT 
        pl.pid,
        pa.usename,
        pa.application_name,
        pl.locktype,
        pl.mode,
        pl.granted,
        pa.query,
        EXTRACT(EPOCH FROM (NOW() - pa.state_change)) as duration_seconds
      FROM pg_locks pl
      LEFT JOIN pg_stat_activity pa ON pl.pid = pa.pid
      WHERE NOT pl.granted OR pl.locktype != 'relation'
      ORDER BY pl.granted, duration_seconds DESC;
    `;
    const result = await this.postgresService.query(query);
    return { locks: result.rows };
  }

  @Get('performance-history')
  async getPerformanceHistory() {
    try {
      // 1 hour ago
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const metricsData = await this.prisma.metric.findMany({
        where: {
          metricType: 'database',
          timestamp: { gt: oneHourAgo },
        },
        orderBy: { timestamp: 'asc' },
        take: 1000,
      });
      
      // Transform into time-series format
      const metrics = {
        timestamps: [] as number[],
        connections: [] as number[],
        transactions: [] as number[],
        cacheHitRatio: [] as number[],
      };

      metricsData.forEach((row) => {
        const data = row.data as any;
        metrics.timestamps.push(row.timestamp.getTime());
        
        if (data.active_connections !== undefined) {
          metrics.connections.push(data.active_connections);
        }
        if (data.committed_transactions !== undefined) {
          metrics.transactions.push(data.committed_transactions);
        }
        if (data.cache_hit_ratio !== undefined) {
          metrics.cacheHitRatio.push(parseFloat(data.cache_hit_ratio));
        }
      });

      return { metrics, count: metricsData.length };
    } catch (error) {
      console.error('Performance history query failed:', error);
      return { metrics: { timestamps: [], connections: [], transactions: [], cacheHitRatio: [] }, count: 0 };
    }
  }

  @Get('disk-usage')
  async getDiskUsage() {
    const query = `
      SELECT 
        pg_database.datname as database_name,
        pg_size_pretty(pg_database_size(pg_database.datname)) as database_size,
        pg_database_size(pg_database.datname) as database_bytes
      FROM pg_database
      WHERE datname = current_database();
    `;
    
    const tablesQuery = `
      SELECT 
        quote_ident(schemaname) || '.' || quote_ident(tablename) as table_name,
        pg_size_pretty(pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename))) as total_size,
        pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename)) as total_bytes,
        pg_size_pretty(pg_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename))) as table_size,
        pg_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename)) as table_bytes,
        pg_size_pretty(pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename)) - 
                       pg_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename))) as index_size,
        (pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename)) - 
         pg_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename))) as index_bytes
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY total_bytes DESC
      LIMIT 20;
    `;

    const [dbResult, tablesResult] = await Promise.all([
      this.postgresService.query(query),
      this.postgresService.query(tablesQuery),
    ]);

    return {
      database: dbResult.rows[0] || {},
      tables: tablesResult.rows,
      totalTables: tablesResult.rowCount,
    };
  }

  @Get('databases')
  async getDatabases() {
    try {
      const query = `
        SELECT
          d.datname as database_name,
          pg_size_pretty(pg_database_size(d.datname)) as size,
          pg_database_size(d.datname) as size_bytes,
          s.numbackends as connections,
          s.xact_commit as commits,
          s.xact_rollback as rollbacks,
          CASE WHEN (s.blks_hit + s.blks_read) > 0
            THEN ROUND(100.0 * s.blks_hit / (s.blks_hit + s.blks_read), 2)
            ELSE 0
          END as cache_hit_ratio
        FROM pg_database d
        LEFT JOIN pg_stat_database s ON d.datname = s.datname
        WHERE d.datistemplate = false
        ORDER BY pg_database_size(d.datname) DESC;
      `;
      const result = await this.postgresService.query(query);
      return { databases: result.rows || [] };
    } catch (error) {
      console.error('Failed to fetch databases:', error);
      return { databases: [] };
    }
  }

  @Get('database-table-sizes')
  async getDatabaseTableSizes(@Query('database') database?: string) {
    try {
      // 현재 연결된 데이터베이스의 테이블만 조회 가능
      const currentDbQuery = `SELECT current_database() as dbname;`;
      const currentDbResult = await this.postgresService.query(currentDbQuery);
      const currentDb = currentDbResult.rows[0]?.dbname;

      const query = `
        SELECT
          current_database() as database_name,
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename))) AS total_size,
          pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename)) AS total_bytes,
          pg_size_pretty(pg_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename))) AS table_size,
          pg_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename)) AS table_bytes,
          pg_size_pretty(pg_indexes_size(quote_ident(schemaname)||'.'||quote_ident(tablename))) AS index_size,
          pg_indexes_size(quote_ident(schemaname)||'.'||quote_ident(tablename)) AS index_bytes,
          COALESCE((SELECT n_live_tup FROM pg_stat_user_tables t
            WHERE t.schemaname = pg_tables.schemaname AND t.relname = pg_tables.tablename), 0) as row_estimate
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY total_bytes DESC
        LIMIT 50;
      `;
      const result = await this.postgresService.query(query);
      return {
        database: currentDb,
        tables: result.rows || [],
        totalCount: result.rowCount || 0,
      };
    } catch (error) {
      console.error('Failed to fetch database table sizes:', error);
      return {
        database: 'unknown',
        tables: [],
        totalCount: 0,
      };
    }
  }

  @Get('replication-status')
  async getReplicationStatus() {
    const query = `
      SELECT 
        application_name,
        client_addr,
        state,
        sync_state,
        EXTRACT(EPOCH FROM (NOW() - backend_start)) as uptime_seconds,
        pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn) as send_lag_bytes,
        pg_wal_lsn_diff(pg_current_wal_lsn(), write_lsn) as write_lag_bytes,
        pg_wal_lsn_diff(pg_current_wal_lsn(), flush_lsn) as flush_lag_bytes,
        pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) as replay_lag_bytes,
        EXTRACT(EPOCH FROM write_lag) as write_lag_seconds,
        EXTRACT(EPOCH FROM flush_lag) as flush_lag_seconds,
        EXTRACT(EPOCH FROM replay_lag) as replay_lag_seconds
      FROM pg_stat_replication;
    `;

    try {
      const result = await this.postgresService.query(query);
      return {
        configured: result.rowCount > 0,
        replicas: result.rows,
        count: result.rowCount,
      };
    } catch (error) {
      // If pg_stat_replication doesn't exist or query fails, replication is not configured
      console.log('Replication not configured or query failed:', error.message);
      return {
        configured: false,
        replicas: [],
        count: 0,
      };
    }
  }
}
