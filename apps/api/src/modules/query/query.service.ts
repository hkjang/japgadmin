import { Injectable } from '@nestjs/common';
import { PostgresService } from '../../database/postgres.service';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class QueryService {
  constructor(
    private readonly postgresService: PostgresService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * 느린 쿼리 조회 (pg_stat_statements 사용)
   */
  async getSlowQueries(limit: number = 50, minTime: number = 1000) {
    const query = `
      SELECT 
        queryid,
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        min_exec_time,
        max_exec_time,
        stddev_exec_time,
        rows,
        shared_blks_hit,
        shared_blks_read,
        shared_blks_written,
        temp_blks_read,
        temp_blks_written
      FROM pg_stat_statements
      WHERE mean_exec_time > $1
      ORDER BY total_exec_time DESC
      LIMIT $2
    `;

    try {
      const result = await this.postgresService.query(query, [minTime, limit]);
      
      return {
        timestamp: new Date(),
        count: result.rowCount,
        minExecutionTime: minTime,
        queries: result.rows,
      };
    } catch (error) {
      // pg_stat_statements가 설치되지 않은 경우
      if (error.message.includes('pg_stat_statements')) {
        return {
          timestamp: new Date(),
          error: 'pg_stat_statements extension is not installed',
          message: 'Please install pg_stat_statements extension to use this feature',
        };
      }
      throw error;
    }
  }

  /**
   * Query Plan 분석 (EXPLAIN ANALYZE)
   */
  async explainQuery(sqlQuery: string, analyze = false) {
    const explainCommand = analyze ? 'EXPLAIN ANALYZE' : 'EXPLAIN';
    const query = `${explainCommand} ${sqlQuery}`;

    try {
      const result = await this.postgresService.query(query);
      
      return {
        timestamp: new Date(),
        query: sqlQuery,
        analyzed: analyze,
        plan: result.rows.map(row => row['QUERY PLAN']).join('\n'),
      };
    } catch (error) {
      return {
        timestamp: new Date(),
        query: sqlQuery,
        error: error.message,
      };
    }
  }

  /**
   * 쿼리 히스토리 조회
   */
  async getQueryHistory(limit: number = 100, queryHash?: string) {
    const where: any = {
      targetDb: process.env.TARGET_DB_NAME || 'target_db',
    };

    if (queryHash) {
      where.queryHash = queryHash;
    }

    const history = await this.prismaService.queryHistory.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return {
      count: history.length,
      history,
    };
  }

  /**
   * 쿼리 통계
   */
  async getQueryStats() {
    const query = `
      SELECT 
        COUNT(DISTINCT queryid) as unique_queries,
        SUM(calls) as total_calls,
        SUM(total_exec_time) as total_execution_time,
        AVG(mean_exec_time) as avg_execution_time,
        MAX(max_exec_time) as max_execution_time
      FROM pg_stat_statements
    `;

    try {
      const result = await this.postgresService.query(query);
      const stats = result.rows[0] || {};

      return {
        timestamp: new Date(),
        stats,
      };
    } catch (error) {
      if (error.message.includes('pg_stat_statements')) {
        return {
          timestamp: new Date(),
          error: 'pg_stat_statements extension is not installed',
        };
      }
      throw error;
    }
  }

  /**
   * 쿼리 해시 생성
   */
  private generateQueryHash(query: string): string {
    return crypto.createHash('md5').update(query).digest('hex');
  }

  /**
   * 쿼리 히스토리 저장
   */
  async saveQueryHistory(query: string, executionTime: number, rowsAffected?: number) {
    const queryHash = this.generateQueryHash(query);

    await this.prismaService.queryHistory.create({
      data: {
        targetDb: process.env.TARGET_DB_NAME || 'target_db',
        query,
        executionTime,
        rowsAffected,
        queryHash,
      },
    });
  }
}
