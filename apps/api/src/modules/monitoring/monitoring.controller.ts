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
}
