import { Controller, Get } from '@nestjs/common';
import { PostgresService } from '../../database/postgres.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly postgresService: PostgresService) {}

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
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
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
        COUNT(*) as total_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
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
    const query = `
      SELECT 
        EXTRACT(EPOCH FROM timestamp) * 1000 as timestamp,
        data
      FROM "Metric"
      WHERE "metricType" IN ('database', 'activity')
        AND timestamp > NOW() - INTERVAL '1 hour'
      ORDER BY timestamp ASC
      LIMIT 100;
    `;
    try {
      const result = await this.postgresService.query(query);
      
      // Transform into time-series format
      const metrics = {
        timestamps: [],
        connections: [],
        transactions: [],
        cacheHitRatio: [],
      };

      result.rows.forEach(row => {
        metrics.timestamps.push(row.timestamp);
        if (row.data.active_connections !== undefined) {
          metrics.connections.push(row.data.active_connections);
        }
        if (row.data.committed_transactions !== undefined) {
          metrics.transactions.push(row.data.committed_transactions);
        }
        if (row.data.cache_hit_ratio !== undefined) {
          metrics.cacheHitRatio.push(parseFloat(row.data.cache_hit_ratio));
        }
      });

      return { metrics, count: result.rowCount };
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
        schemaname || '.' || tablename as table_name,
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
