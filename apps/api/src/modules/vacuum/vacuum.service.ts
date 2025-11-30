import { Injectable } from '@nestjs/common';
import { PostgresService } from '../../database/postgres.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class VacuumService {
  constructor(
    private readonly postgresService: PostgresService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * VACUUM 실행
   */
  async executeVacuum(
    tableName: string,
    vacuumType: 'VACUUM' | 'VACUUM FULL' | 'ANALYZE',
    verbose = false,
  ) {
    const startTime = Date.now();
    let status = 'success';
    let errorMessage: string | null = null;

    try {
      const verboseStr = verbose ? 'VERBOSE' : '';
      const command = `${vacuumType} ${verboseStr} ${tableName}`;
      
      await this.postgresService.query(command);
      
      const duration = Date.now() - startTime;

      await this.prismaService.vacuumHistory.create({
        data: {
          targetDb: process.env.TARGET_DB_NAME || 'target_db',
          tableName,
          vacuumType,
          duration,
          status,
          errorMessage,
        },
      });

      return {
        success: true,
        tableName,
        vacuumType,
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      status = 'failed';
      errorMessage = error.message;

      await this.prismaService.vacuumHistory.create({
        data: {
          targetDb: process.env.TARGET_DB_NAME || 'target_db',
          tableName,
          vacuumType,
          duration: Date.now() - startTime,
          status,
          errorMessage,
        },
      });

      throw error;
    }
  }

  /**
   * VACUUM 실행 히스토리 조회
   */
  async getHistory(limit: number = 50, tableName?: string) {
    const where: any = {
      targetDb: process.env.TARGET_DB_NAME || 'target_db',
    };

    if (tableName) {
      where.tableName = tableName;
    }

    const history = await this.prismaService.vacuumHistory.findMany({
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
   * Autovacuum 활동 통계
   */
  async getAutovacuumStats() {
    const query = `
      SELECT 
        schemaname,
        relname as table_name,
        last_vacuum,
        last_autovacuum,
        vacuum_count,
        autovacuum_count,
        last_analyze,
        last_autoanalyze,
        analyze_count,
        autoanalyze_count,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples,
        CASE 
          WHEN n_live_tup > 0 
          THEN ROUND((n_dead_tup::numeric / n_live_tup) * 100, 2)
          ELSE 0
        END as dead_tuple_percentage
      FROM pg_stat_user_tables
      ORDER BY n_dead_tup DESC
    `;

    const result = await this.postgresService.query(query);

    return {
      timestamp: new Date(),
      count: result.rowCount,
      tables: result.rows,
    };
  }

  /**
   * 테이블별 VACUUM 통계
   */
  async getTableVacuumStats() {
    const query = `
      SELECT 
        schemaname,
        relname as table_name,
        n_dead_tup as dead_tuples,
        n_live_tup as live_tuples,
        last_autovacuum,
        last_vacuum,
        autovacuum_count,
        vacuum_count,
        CASE 
          WHEN n_live_tup > 0 
          THEN ROUND((n_dead_tup::numeric / (n_live_tup + n_dead_tup)) * 100, 2)
          ELSE 0
        END as bloat_percentage,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as total_size
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 0
      ORDER BY n_dead_tup DESC
      LIMIT 20
    `;

    const result = await this.postgresService.query(query);

    return {
      timestamp: new Date(),
      count: result.rowCount,
      tables: result.rows,
    };
  }
}
