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

  /**
   * 전역 Autovacuum 설정 조회
   */
  async getGlobalSettings() {
    const query = `
      SELECT name, setting, unit, short_desc, min_val, max_val
      FROM pg_settings
      WHERE name LIKE 'autovacuum%' OR name = 'vacuum_cost_delay' OR name = 'vacuum_cost_limit'
      ORDER BY name;
    `;
    const result = await this.postgresService.query(query);
    return result.rows;
  }

  /**
   * 테이블별 Autovacuum 설정 조회
   */
  async getTableSettings(tableName: string) {
    // Note: Parameterized query for value, but ensure tableName is valid exists first preferably.
    const query = `
      SELECT relname, reloptions
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = $1 AND n.nspname = 'public' -- Assuming public schema or need schema param
      AND c.relkind = 'r';
    `;
    const result = await this.postgresService.query(query, [tableName]);
    if (result.rowCount === 0) return null;
    
    // Parse reloptions array formatted like "{autovacuum_enabled=true,autovacuum_vacuum_threshold=50}"
    const optionsArray = result.rows[0].reloptions || [];
    const options: Record<string, string> = {};
    
    // Postgres returns array as string in some drivers, or array object
    // Assuming pg driver returns array of strings
    if (Array.isArray(optionsArray)) {
        optionsArray.forEach((opt: string) => {
            const [key, value] = opt.split('=');
            options[key] = value;
        });
    }

    return options;
  }

  /**
   * 테이블 Autovacuum 설정 업데이트
   */
  async updateTableSettings(tableName: string, settings: Record<string, string | null>) {
    // Valid keys whitelist to prevent SQL injection via keys
    const validKeys = [
      'autovacuum_enabled',
      'autovacuum_vacuum_threshold',
      'autovacuum_vacuum_scale_factor',
      'autovacuum_analyze_threshold',
      'autovacuum_analyze_scale_factor',
      'autovacuum_vacuum_cost_delay',
      'autovacuum_vacuum_cost_limit',
      'autovacuum_freeze_min_age',
      'autovacuum_freeze_max_age',
      'autovacuum_multixact_freeze_min_age',
      'autovacuum_multixact_freeze_max_age'
    ];

    const setList: string[] = [];
    const resetList: string[] = [];

    Object.entries(settings).forEach(([key, value]) => {
      if (!validKeys.includes(key)) return;

      if (value === null) {
        resetList.push(key);
      } else {
        setList.push(`${key} = ${value}`); // Values are typically numbers or booleans
      }
    });

    // TODO: Sanitize tableName properly (e.g. quote_ident equivalent)
    // For now simple double quotes
    const safeTableName = `"${tableName.replace(/"/g, '""')}"`;

    if (setList.length > 0) {
      const setCommand = `ALTER TABLE ${safeTableName} SET (${setList.join(', ')});`;
      await this.postgresService.query(setCommand);
    }

    if (resetList.length > 0) {
      const resetCommand = `ALTER TABLE ${safeTableName} RESET (${resetList.join(', ')});`;
      await this.postgresService.query(resetCommand);
    }

    return { success: true };
  }
}
