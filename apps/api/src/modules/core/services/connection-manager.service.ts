import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, PoolConfig } from 'pg';
import { PrismaService } from '../../../database/prisma.service';
import { Instance, ConnectionMode, SslMode } from '@prisma/client';

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  version?: string;
  latencyMs?: number;
}

export interface QueryOptions {
  timeout?: number; // ms
  rowLimit?: number;
  includeExplain?: boolean;
}

export interface QueryExecutionResult {
  rows: any[];
  rowCount: number;
  fields: { name: string; dataTypeID: number }[];
  executionTimeMs: number;
  explainPlan?: any;
}

interface PoolEntry {
  pool: Pool;
  instanceId: string;
  createdAt: Date;
  lastUsedAt: Date;
  connectionCount: number;
}

@Injectable()
export class ConnectionManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(ConnectionManagerService.name);
  private readonly pools: Map<string, PoolEntry> = new Map();
  private readonly MAX_POOL_IDLE_TIME = 30 * 60 * 1000; // 30 minutes
  private cleanupInterval: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {
    // Cleanup idle pools every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupIdlePools(), 5 * 60 * 1000);
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    await this.closeAllPools();
  }

  /**
   * Get or create a connection pool for an instance
   */
  async getPool(instanceId: string): Promise<Pool> {
    const existing = this.pools.get(instanceId);
    if (existing) {
      existing.lastUsedAt = new Date();
      return existing.pool;
    }

    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      include: {
        credential: true,
        networkConfig: true,
      },
    });

    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    const pool = await this.createPool(instance);
    this.pools.set(instanceId, {
      pool,
      instanceId,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      connectionCount: 0,
    });

    return pool;
  }

  /**
   * Create a new connection pool for an instance
   */
  private async createPool(instance: Instance & { credential?: any; networkConfig?: any }): Promise<Pool> {
    const credentials = await this.resolveCredentials(instance);

    const poolConfig: PoolConfig = {
      host: instance.host,
      port: instance.port,
      database: (instance as any).defaultDatabase || 'postgres', // Use instance default database
      user: credentials.username,
      password: credentials.password,
      max: instance.maxConnections,
      connectionTimeoutMillis: instance.connectionTimeout,
      idleTimeoutMillis: 30000,
      ssl: this.getSslConfig(instance.sslMode),
    };

    // Handle different connection modes
    if (instance.connectionMode === ConnectionMode.SSH_TUNNEL && instance.networkConfig) {
      // SSH tunnel would require additional setup
      // For now, we'll just use direct connection
      this.logger.warn(`SSH tunnel not yet implemented for instance ${instance.id}, using direct connection`);
    }

    const pool = new Pool(poolConfig);

    // Set up pool event handlers
    pool.on('error', (err) => {
      this.logger.error(`Pool error for instance ${instance.id}:`, err);
    });

    pool.on('connect', () => {
      const entry = this.pools.get(instance.id);
      if (entry) {
        entry.connectionCount++;
      }
    });

    return pool;
  }

  /**
   * Resolve credentials for an instance
   */
  private async resolveCredentials(instance: Instance & { credential?: any }): Promise<{ username: string; password: string }> {
    if (!instance.credential) {
      // Default credentials for development
      return {
        username: 'postgres',
        password: 'postgres',
      };
    }

    // Decrypt stored credentials
    if (instance.credential.encryptedData) {
      try {
        // TODO: Implement proper decryption with KMS
        const decrypted = JSON.parse(instance.credential.encryptedData);
        return {
          username: decrypted.username || 'postgres',
          password: decrypted.password || 'postgres',
        };
      } catch (e) {
        this.logger.error(`Failed to decrypt credentials for instance ${instance.id}:`, e);
        throw new Error('Failed to decrypt credentials');
      }
    }

    // TODO: Implement vault integration
    if (instance.credential.vaultPath) {
      throw new Error('Vault integration not yet implemented');
    }

    return {
      username: 'postgres',
      password: 'postgres',
    };
  }

  /**
   * Get SSL configuration based on mode
   */
  private getSslConfig(sslMode: SslMode): boolean | object {
    switch (sslMode) {
      case SslMode.DISABLE:
        return false;
      case SslMode.ALLOW:
      case SslMode.PREFER:
        return { rejectUnauthorized: false };
      case SslMode.REQUIRE:
        return { rejectUnauthorized: false };
      case SslMode.VERIFY_CA:
      case SslMode.VERIFY_FULL:
        return { rejectUnauthorized: true };
      default:
        return false;
    }
  }

  /**
   * Get a single connection from the pool
   */
  async getConnection(instanceId: string): Promise<PoolClient> {
    const pool = await this.getPool(instanceId);
    return pool.connect();
  }

  /**
   * Execute a query on an instance
   */
  async executeQuery(
    instanceId: string,
    query: string,
    params?: any[],
    options: QueryOptions = {},
  ): Promise<QueryExecutionResult> {
    const pool = await this.getPool(instanceId);
    const client = await pool.connect();

    try {
      const startTime = Date.now();

      // Set statement timeout if specified
      if (options.timeout) {
        await client.query(`SET statement_timeout = ${options.timeout}`);
      }

      // Get explain plan if requested
      let explainPlan: any;
      if (options.includeExplain && this.isSelectQuery(query)) {
        const explainResult = await client.query(`EXPLAIN (FORMAT JSON, ANALYZE) ${query}`, params);
        explainPlan = explainResult.rows[0]['QUERY PLAN'];
      }

      // Execute the actual query
      let finalQuery = query;
      if (options.rowLimit && this.isSelectQuery(query) && !query.toLowerCase().includes('limit')) {
        finalQuery = `${query} LIMIT ${options.rowLimit}`;
      }

      const result = await client.query(finalQuery, params);
      const executionTimeMs = Date.now() - startTime;

      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
        executionTimeMs,
        explainPlan,
      };
    } finally {
      // Reset statement timeout
      if (options.timeout) {
        await client.query('SET statement_timeout = 0').catch(() => {});
      }
      client.release();
    }
  }

  /**
   * Execute a query that returns a single result
   */
  async queryOne<T>(instanceId: string, query: string, params?: any[]): Promise<T | null> {
    const result = await this.executeQuery(instanceId, query, params, { rowLimit: 1 });
    return result.rows[0] || null;
  }

  /**
   * Execute a query that returns multiple results
   */
  async queryMany<T>(instanceId: string, query: string, params?: any[]): Promise<T[]> {
    const result = await this.executeQuery(instanceId, query, params);
    return result.rows;
  }

  /**
   * Test connection to an instance
   */
  async testConnection(instanceId: string): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      const pool = await this.getPool(instanceId);
      const client = await pool.connect();

      try {
        const result = await client.query('SELECT version()');
        const latencyMs = Date.now() - startTime;

        return {
          success: true,
          message: '연결 성공',
          version: result.rows[0].version,
          latencyMs,
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        success: false,
        message: `연결 실패: ${error.message}`,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Test connection with custom parameters (for new instance registration)
   */
  async testConnectionWithParams(params: {
    host: string;
    port: number;
    database?: string;
    username: string;
    password: string;
    sslMode?: SslMode;
  }): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    const pool = new Pool({
      host: params.host,
      port: params.port,
      database: params.database || 'postgres',
      user: params.username,
      password: params.password,
      max: 1,
      connectionTimeoutMillis: 10000,
      ssl: this.getSslConfig(params.sslMode || SslMode.PREFER),
    });

    try {
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT version()');
        const latencyMs = Date.now() - startTime;

        return {
          success: true,
          message: '연결 성공',
          version: result.rows[0].version,
          latencyMs,
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        success: false,
        message: `연결 실패: ${error.message}`,
        latencyMs: Date.now() - startTime,
      };
    } finally {
      await pool.end();
    }
  }

  /**
   * Get pool statistics for an instance
   */
  getPoolStats(instanceId: string): { totalCount: number; idleCount: number; waitingCount: number } | null {
    const entry = this.pools.get(instanceId);
    if (!entry) {
      return null;
    }

    return {
      totalCount: entry.pool.totalCount,
      idleCount: entry.pool.idleCount,
      waitingCount: entry.pool.waitingCount,
    };
  }

  /**
   * Close pool for a specific instance
   */
  async closePool(instanceId: string): Promise<void> {
    const entry = this.pools.get(instanceId);
    if (entry) {
      await entry.pool.end();
      this.pools.delete(instanceId);
      this.logger.log(`Closed pool for instance ${instanceId}`);
    }
  }

  /**
   * Close all pools
   */
  async closeAllPools(): Promise<void> {
    const closePromises = Array.from(this.pools.entries()).map(async ([instanceId, entry]) => {
      await entry.pool.end();
      this.logger.log(`Closed pool for instance ${instanceId}`);
    });

    await Promise.all(closePromises);
    this.pools.clear();
  }

  /**
   * Clean up idle pools
   */
  private async cleanupIdlePools(): Promise<void> {
    const now = Date.now();
    const idlePools: string[] = [];

    this.pools.forEach((entry, instanceId) => {
      if (now - entry.lastUsedAt.getTime() > this.MAX_POOL_IDLE_TIME) {
        idlePools.push(instanceId);
      }
    });

    for (const instanceId of idlePools) {
      await this.closePool(instanceId);
      this.logger.log(`Cleaned up idle pool for instance ${instanceId}`);
    }
  }

  /**
   * Refresh pool for an instance (close and recreate)
   */
  async refreshPool(instanceId: string): Promise<void> {
    await this.closePool(instanceId);
    await this.getPool(instanceId);
  }

  /**
   * Update instance status based on connection test
   */
  async updateInstanceStatus(instanceId: string): Promise<void> {
    const result = await this.testConnection(instanceId);

    await this.prisma.instance.update({
      where: { id: instanceId },
      data: {
        status: result.success ? 'ONLINE' : 'OFFLINE',
        lastSeenAt: result.success ? new Date() : undefined,
        pgVersion: result.version ? this.extractPgVersion(result.version) : undefined,
      },
    });
  }

  /**
   * Extract PostgreSQL version from version string
   */
  private extractPgVersion(versionString: string): string {
    const match = versionString.match(/PostgreSQL (\d+\.\d+)/);
    return match ? match[1] : versionString.substring(0, 50);
  }

  /**
   * Check if query is a SELECT query
   */
  private isSelectQuery(query: string): boolean {
    const trimmed = query.trim().toLowerCase();
    return trimmed.startsWith('select') || trimmed.startsWith('with');
  }

  /**
   * Get all active pool instance IDs
   */
  getActivePoolIds(): string[] {
    return Array.from(this.pools.keys());
  }
}
