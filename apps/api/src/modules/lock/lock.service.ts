import { Injectable, Logger } from '@nestjs/common';
import { ConnectionManagerService } from '../core/services/connection-manager.service';
import { PrismaService } from '../../database/prisma.service';

export interface LockInfo {
  pid: number;
  locktype: string;
  database: string;
  relation: string;
  page: number;
  tuple: number;
  virtualxid: string;
  transactionid: string;
  classid: number;
  objid: number;
  objsubid: number;
  virtualtransaction: string;
  mode: string;
  granted: boolean;
  fastpath: boolean;
  waitstart: Date;
  usename: string;
  datname: string;
  query: string;
  wait_duration_ms: number;
}

export interface BlockingTreeNode {
  pid: number;
  usename: string;
  datname: string;
  query: string;
  state: string;
  wait_event_type: string;
  wait_event: string;
  duration_ms: number;
  level: number;
  blocked_by: number[];
  blocking: number[];
}

export interface DeadlockInfo {
  detected: boolean;
  cycles: number[][];
  message: string;
}

@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name);

  constructor(
    private readonly connectionManager: ConnectionManagerService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get all locks for an instance
   */
  async getLocks(instanceId: string, options?: {
    granted?: boolean;
    locktype?: string;
    pid?: number;
  }): Promise<LockInfo[]> {
    let query = `
      SELECT
        l.pid,
        l.locktype,
        l.database::text,
        COALESCE(c.relname, '') as relation,
        l.page,
        l.tuple,
        l.virtualxid,
        l.transactionid::text,
        l.classid,
        l.objid,
        l.objsubid,
        l.virtualtransaction,
        l.mode,
        l.granted,
        l.fastpath,
        l.waitstart,
        a.usename,
        a.datname,
        a.query,
        EXTRACT(EPOCH FROM (NOW() - COALESCE(l.waitstart, a.query_start)))::int * 1000 AS wait_duration_ms
      FROM pg_locks l
      LEFT JOIN pg_class c ON l.relation = c.oid
      LEFT JOIN pg_stat_activity a ON l.pid = a.pid
      WHERE l.pid != pg_backend_pid()
    `;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.granted !== undefined) {
      conditions.push(`l.granted = $${paramIndex++}`);
      params.push(options.granted);
    }

    if (options?.locktype) {
      conditions.push(`l.locktype = $${paramIndex++}`);
      params.push(options.locktype);
    }

    if (options?.pid) {
      conditions.push(`l.pid = $${paramIndex++}`);
      params.push(options.pid);
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY l.granted, wait_duration_ms DESC`;

    const result = await this.connectionManager.executeQuery(instanceId, query, params);
    return result.rows as LockInfo[];
  }

  /**
   * Get waiting locks (blocked locks)
   */
  async getWaitingLocks(instanceId: string): Promise<LockInfo[]> {
    return this.getLocks(instanceId, { granted: false });
  }

  /**
   * Build blocking tree
   */
  async getBlockingTree(instanceId: string): Promise<BlockingTreeNode[]> {
    // First, get all blocking relationships
    const blockingQuery = `
      WITH RECURSIVE blocking_tree AS (
        -- Base: all blocked sessions
        SELECT
          blocked.pid AS blocked_pid,
          blocked.usename AS blocked_user,
          blocked.datname AS blocked_db,
          blocked.query AS blocked_query,
          blocked.state AS blocked_state,
          blocked.wait_event_type,
          blocked.wait_event,
          EXTRACT(EPOCH FROM (NOW() - blocked.query_start))::int * 1000 AS blocked_duration_ms,
          blocker.pid AS blocker_pid,
          blocker.usename AS blocker_user,
          blocker.query AS blocker_query,
          blocker.state AS blocker_state,
          EXTRACT(EPOCH FROM (NOW() - blocker.query_start))::int * 1000 AS blocker_duration_ms,
          0 AS level,
          ARRAY[blocker.pid] AS path
        FROM pg_locks blocked_locks
        JOIN pg_stat_activity blocked ON blocked.pid = blocked_locks.pid
        JOIN pg_locks blocker_locks ON (
          blocker_locks.locktype = blocked_locks.locktype
          AND blocker_locks.database IS NOT DISTINCT FROM blocked_locks.database
          AND blocker_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
          AND blocker_locks.page IS NOT DISTINCT FROM blocked_locks.page
          AND blocker_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
          AND blocker_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
          AND blocker_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
          AND blocker_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
          AND blocker_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
          AND blocker_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
          AND blocker_locks.pid != blocked_locks.pid
        )
        JOIN pg_stat_activity blocker ON blocker.pid = blocker_locks.pid
        WHERE NOT blocked_locks.granted AND blocker_locks.granted
      )
      SELECT DISTINCT ON (blocked_pid, blocker_pid)
        blocked_pid,
        blocked_user,
        blocked_db,
        blocked_query,
        blocked_state,
        wait_event_type,
        wait_event,
        blocked_duration_ms,
        blocker_pid,
        blocker_user,
        blocker_query,
        blocker_state,
        blocker_duration_ms,
        level
      FROM blocking_tree
      ORDER BY blocked_pid, blocker_pid, level
    `;

    const result = await this.connectionManager.executeQuery(instanceId, blockingQuery);
    const relationships = result.rows;

    // Build the tree structure
    const nodeMap = new Map<number, BlockingTreeNode>();

    // Collect all PIDs
    for (const row of relationships) {
      if (!nodeMap.has(row.blocked_pid)) {
        nodeMap.set(row.blocked_pid, {
          pid: row.blocked_pid,
          usename: row.blocked_user,
          datname: row.blocked_db,
          query: row.blocked_query,
          state: row.blocked_state,
          wait_event_type: row.wait_event_type,
          wait_event: row.wait_event,
          duration_ms: row.blocked_duration_ms,
          level: 0,
          blocked_by: [],
          blocking: [],
        });
      }

      if (!nodeMap.has(row.blocker_pid)) {
        nodeMap.set(row.blocker_pid, {
          pid: row.blocker_pid,
          usename: row.blocker_user,
          datname: row.blocked_db,
          query: row.blocker_query,
          state: row.blocker_state,
          wait_event_type: null,
          wait_event: null,
          duration_ms: row.blocker_duration_ms,
          level: 0,
          blocked_by: [],
          blocking: [],
        });
      }

      // Add relationships
      const blockedNode = nodeMap.get(row.blocked_pid);
      const blockerNode = nodeMap.get(row.blocker_pid);

      if (!blockedNode.blocked_by.includes(row.blocker_pid)) {
        blockedNode.blocked_by.push(row.blocker_pid);
      }
      if (!blockerNode.blocking.includes(row.blocked_pid)) {
        blockerNode.blocking.push(row.blocked_pid);
      }
    }

    // Calculate levels (root blockers have level 0)
    const calculateLevel = (pid: number, visited: Set<number> = new Set()): number => {
      if (visited.has(pid)) return 0; // Cycle detected
      visited.add(pid);

      const node = nodeMap.get(pid);
      if (!node || node.blocked_by.length === 0) return 0;

      let maxLevel = 0;
      for (const blockerPid of node.blocked_by) {
        maxLevel = Math.max(maxLevel, calculateLevel(blockerPid, visited) + 1);
      }
      return maxLevel;
    };

    for (const [pid, node] of nodeMap) {
      node.level = calculateLevel(pid);
    }

    return Array.from(nodeMap.values()).sort((a, b) => a.level - b.level);
  }

  /**
   * Detect potential deadlocks
   */
  async detectDeadlocks(instanceId: string): Promise<DeadlockInfo> {
    const tree = await this.getBlockingTree(instanceId);

    // Build adjacency list for cycle detection
    const graph = new Map<number, number[]>();
    for (const node of tree) {
      graph.set(node.pid, node.blocked_by);
    }

    // DFS to find cycles
    const cycles: number[][] = [];
    const visited = new Set<number>();
    const recursionStack = new Set<number>();

    const dfs = (pid: number, path: number[]): void => {
      visited.add(pid);
      recursionStack.add(pid);
      path.push(pid);

      const blockers = graph.get(pid) || [];
      for (const blocker of blockers) {
        if (!visited.has(blocker)) {
          dfs(blocker, [...path]);
        } else if (recursionStack.has(blocker)) {
          // Cycle detected
          const cycleStart = path.indexOf(blocker);
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart));
          }
        }
      }

      recursionStack.delete(pid);
    };

    for (const pid of graph.keys()) {
      if (!visited.has(pid)) {
        dfs(pid, []);
      }
    }

    return {
      detected: cycles.length > 0,
      cycles,
      message: cycles.length > 0
        ? `${cycles.length}개의 데드락 사이클이 감지되었습니다.`
        : '데드락이 감지되지 않았습니다.',
    };
  }

  /**
   * Get lock statistics
   */
  async getLockStats(instanceId: string): Promise<{
    totalLocks: number;
    grantedLocks: number;
    waitingLocks: number;
    byType: Record<string, number>;
    byMode: Record<string, number>;
  }> {
    const query = `
      SELECT
        COUNT(*) as total_locks,
        COUNT(*) FILTER (WHERE granted) as granted_locks,
        COUNT(*) FILTER (WHERE NOT granted) as waiting_locks
      FROM pg_locks
      WHERE pid != pg_backend_pid()
    `;

    const byTypeQuery = `
      SELECT locktype, COUNT(*) as count
      FROM pg_locks
      WHERE pid != pg_backend_pid()
      GROUP BY locktype
      ORDER BY count DESC
    `;

    const byModeQuery = `
      SELECT mode, COUNT(*) as count
      FROM pg_locks
      WHERE pid != pg_backend_pid()
      GROUP BY mode
      ORDER BY count DESC
    `;

    const [statsResult, byTypeResult, byModeResult] = await Promise.all([
      this.connectionManager.executeQuery(instanceId, query),
      this.connectionManager.executeQuery(instanceId, byTypeQuery),
      this.connectionManager.executeQuery(instanceId, byModeQuery),
    ]);

    const stats = statsResult.rows[0];
    const byType: Record<string, number> = {};
    const byMode: Record<string, number> = {};

    for (const row of byTypeResult.rows) {
      byType[row.locktype] = parseInt(row.count, 10);
    }

    for (const row of byModeResult.rows) {
      byMode[row.mode] = parseInt(row.count, 10);
    }

    return {
      totalLocks: parseInt(stats.total_locks, 10),
      grantedLocks: parseInt(stats.granted_locks, 10),
      waitingLocks: parseInt(stats.waiting_locks, 10),
      byType,
      byMode,
    };
  }

  /**
   * Get table-level lock conflicts
   */
  async getTableLockConflicts(instanceId: string): Promise<any[]> {
    const query = `
      SELECT
        c.relname AS table_name,
        n.nspname AS schema_name,
        l.mode AS lock_mode,
        l.granted,
        a.pid,
        a.usename,
        a.query,
        EXTRACT(EPOCH FROM (NOW() - a.query_start))::int * 1000 AS duration_ms
      FROM pg_locks l
      JOIN pg_class c ON l.relation = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      JOIN pg_stat_activity a ON l.pid = a.pid
      WHERE l.locktype = 'relation'
        AND c.relkind = 'r'
        AND l.pid != pg_backend_pid()
      ORDER BY c.relname, l.granted, duration_ms DESC
    `;

    const result = await this.connectionManager.executeQuery(instanceId, query);
    return result.rows;
  }
}
