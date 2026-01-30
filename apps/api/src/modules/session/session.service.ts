import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConnectionManagerService } from '../core/services/connection-manager.service';
import { PrismaService } from '../../database/prisma.service';

export interface DbSession {
  pid: number;
  datname: string;
  usename: string;
  application_name: string;
  client_addr: string;
  client_hostname: string;
  client_port: number;
  backend_start: Date;
  xact_start: Date;
  query_start: Date;
  state_change: Date;
  wait_event_type: string;
  wait_event: string;
  state: string;
  backend_xid: string;
  backend_xmin: string;
  query: string;
  backend_type: string;
  duration_ms: number;
}

export interface BlockingInfo {
  blocked_pid: number;
  blocked_user: string;
  blocked_query: string;
  blocked_duration_ms: number;
  blocking_pid: number;
  blocking_user: string;
  blocking_query: string;
  blocking_duration_ms: number;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly connectionManager: ConnectionManagerService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get active sessions for an instance
   */
  async getActiveSessions(instanceId: string, options?: {
    state?: string;
    username?: string;
    database?: string;
    minDurationMs?: number;
    excludeIdle?: boolean;
  }): Promise<DbSession[]> {
    let query = `
      SELECT
        pid,
        datname,
        usename,
        application_name,
        client_addr::text,
        client_hostname,
        client_port,
        backend_start,
        xact_start,
        query_start,
        state_change,
        wait_event_type,
        wait_event,
        state,
        backend_xid::text,
        backend_xmin::text,
        query,
        backend_type,
        EXTRACT(EPOCH FROM (NOW() - query_start))::int * 1000 AS duration_ms
      FROM pg_stat_activity
      WHERE pid != pg_backend_pid()
    `;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.state) {
      conditions.push(`state = $${paramIndex++}`);
      params.push(options.state);
    }

    if (options?.username) {
      conditions.push(`usename = $${paramIndex++}`);
      params.push(options.username);
    }

    if (options?.database) {
      conditions.push(`datname = $${paramIndex++}`);
      params.push(options.database);
    }

    if (options?.minDurationMs) {
      conditions.push(`EXTRACT(EPOCH FROM (NOW() - query_start))::int * 1000 >= $${paramIndex++}`);
      params.push(options.minDurationMs);
    }

    if (options?.excludeIdle) {
      conditions.push(`state != 'idle'`);
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY query_start DESC NULLS LAST`;

    const result = await this.connectionManager.executeQuery(instanceId, query, params);
    return result.rows as DbSession[];
  }

  /**
   * Get session by PID
   */
  async getSessionByPid(instanceId: string, pid: number): Promise<DbSession | null> {
    const query = `
      SELECT
        pid,
        datname,
        usename,
        application_name,
        client_addr::text,
        client_hostname,
        client_port,
        backend_start,
        xact_start,
        query_start,
        state_change,
        wait_event_type,
        wait_event,
        state,
        backend_xid::text,
        backend_xmin::text,
        query,
        backend_type,
        EXTRACT(EPOCH FROM (NOW() - query_start))::int * 1000 AS duration_ms
      FROM pg_stat_activity
      WHERE pid = $1
    `;

    const result = await this.connectionManager.executeQuery(instanceId, query, [pid]);
    return result.rows[0] || null;
  }

  /**
   * Cancel a query (pg_cancel_backend)
   */
  async cancelQuery(instanceId: string, pid: number): Promise<boolean> {
    const session = await this.getSessionByPid(instanceId, pid);
    if (!session) {
      throw new BadRequestException(`세션을 찾을 수 없습니다: PID ${pid}`);
    }

    const query = `SELECT pg_cancel_backend($1) as result`;
    const result = await this.connectionManager.executeQuery(instanceId, query, [pid]);

    this.logger.log(`Query cancelled for PID ${pid} on instance ${instanceId}`);
    return result.rows[0]?.result === true;
  }

  /**
   * Terminate a session (pg_terminate_backend)
   */
  async terminateSession(instanceId: string, pid: number): Promise<boolean> {
    const session = await this.getSessionByPid(instanceId, pid);
    if (!session) {
      throw new BadRequestException(`세션을 찾을 수 없습니다: PID ${pid}`);
    }

    const query = `SELECT pg_terminate_backend($1) as result`;
    const result = await this.connectionManager.executeQuery(instanceId, query, [pid]);

    this.logger.log(`Session terminated for PID ${pid} on instance ${instanceId}`);
    return result.rows[0]?.result === true;
  }

  /**
   * Get blocking sessions
   */
  async getBlockingSessions(instanceId: string): Promise<BlockingInfo[]> {
    const query = `
      SELECT
        blocked_locks.pid AS blocked_pid,
        blocked_activity.usename AS blocked_user,
        blocked_activity.query AS blocked_query,
        EXTRACT(EPOCH FROM (NOW() - blocked_activity.query_start))::int * 1000 AS blocked_duration_ms,
        blocking_locks.pid AS blocking_pid,
        blocking_activity.usename AS blocking_user,
        blocking_activity.query AS blocking_query,
        EXTRACT(EPOCH FROM (NOW() - blocking_activity.query_start))::int * 1000 AS blocking_duration_ms
      FROM pg_catalog.pg_locks blocked_locks
      JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
      JOIN pg_catalog.pg_locks blocking_locks ON (
        blocking_locks.locktype = blocked_locks.locktype
        AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
        AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
        AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
        AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
        AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
        AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
        AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
        AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
        AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
        AND blocking_locks.pid != blocked_locks.pid
      )
      JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
      WHERE NOT blocked_locks.granted
      ORDER BY blocked_duration_ms DESC
    `;

    const result = await this.connectionManager.executeQuery(instanceId, query);
    return result.rows as BlockingInfo[];
  }

  /**
   * Get session statistics
   */
  async getSessionStats(instanceId: string): Promise<{
    total: number;
    active: number;
    idle: number;
    idleInTransaction: number;
    waiting: number;
    byState: Record<string, number>;
    byDatabase: Record<string, number>;
  }> {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
        COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting
      FROM pg_stat_activity
      WHERE pid != pg_backend_pid()
    `;

    const byStateQuery = `
      SELECT state, COUNT(*) as count
      FROM pg_stat_activity
      WHERE pid != pg_backend_pid() AND state IS NOT NULL
      GROUP BY state
    `;

    const byDatabaseQuery = `
      SELECT datname, COUNT(*) as count
      FROM pg_stat_activity
      WHERE pid != pg_backend_pid() AND datname IS NOT NULL
      GROUP BY datname
      ORDER BY count DESC
    `;

    const [statsResult, byStateResult, byDatabaseResult] = await Promise.all([
      this.connectionManager.executeQuery(instanceId, query),
      this.connectionManager.executeQuery(instanceId, byStateQuery),
      this.connectionManager.executeQuery(instanceId, byDatabaseQuery),
    ]);

    const stats = statsResult.rows[0];
    const byState: Record<string, number> = {};
    const byDatabase: Record<string, number> = {};

    for (const row of byStateResult.rows) {
      byState[row.state] = parseInt(row.count, 10);
    }

    for (const row of byDatabaseResult.rows) {
      byDatabase[row.datname] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(stats.total, 10),
      active: parseInt(stats.active, 10),
      idle: parseInt(stats.idle, 10),
      idleInTransaction: parseInt(stats.idle_in_transaction, 10),
      waiting: parseInt(stats.waiting, 10),
      byState,
      byDatabase,
    };
  }

  /**
   * Kill idle sessions older than specified duration
   */
  async killIdleSessions(instanceId: string, olderThanMinutes: number): Promise<number> {
    const query = `
      SELECT pid
      FROM pg_stat_activity
      WHERE state = 'idle'
        AND pid != pg_backend_pid()
        AND query_start < NOW() - INTERVAL '${olderThanMinutes} minutes'
    `;

    const result = await this.connectionManager.executeQuery(instanceId, query);
    let killedCount = 0;

    for (const row of result.rows) {
      try {
        await this.terminateSession(instanceId, row.pid);
        killedCount++;
      } catch (e) {
        this.logger.warn(`Failed to terminate idle session ${row.pid}: ${e.message}`);
      }
    }

    return killedCount;
  }
}
