import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConnectionManagerService } from '../core/services/connection-manager.service';
import { SqlSafetyService } from '../security/sql-safety.service';
import { AuditService } from '../audit/audit.service';
import { AuditEventType, ResourceType, ActionType } from '@prisma/client';
import * as crypto from 'crypto';

export interface ExecuteQueryDto {
  instanceId: string;
  query: string;
  params?: any[];
  timeout?: number;
  maxRows?: number;
}

export interface QueryResult {
  success: boolean;
  columns?: string[];
  rows?: any[];
  rowCount?: number;
  executionTime?: number;
  error?: string;
  truncated?: boolean;
}

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  query: string;
  instanceId?: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
}

@Injectable()
export class QueryConsoleService {
  private readonly logger = new Logger(QueryConsoleService.name);
  private readonly DEFAULT_TIMEOUT = 30000; // 30초
  private readonly DEFAULT_MAX_ROWS = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionManager: ConnectionManagerService,
    private readonly sqlSafety: SqlSafetyService,
    private readonly auditService: AuditService,
  ) {}

  // ============ Query Execution ============

  async executeQuery(dto: ExecuteQueryDto, userId?: string): Promise<QueryResult> {
    const startTime = Date.now();
    const timeout = dto.timeout || this.DEFAULT_TIMEOUT;
    const maxRows = dto.maxRows || this.DEFAULT_MAX_ROWS;

    // SQL 안전성 검사
    const safetyCheck = await this.sqlSafety.validateQuery(dto.query, dto.instanceId);
    if (!safetyCheck.safe) {
      throw new BadRequestException(`SQL 안전성 검사 실패: ${safetyCheck.violations.join(', ')}`);
    }

    try {
      // 쿼리 실행
      const result = await this.connectionManager.executeQuery(
        dto.instanceId,
        dto.query,
        dto.params,
        { timeout },
      );

      const executionTime = Date.now() - startTime;
      const truncated = result.rows.length > maxRows;
      const rows = truncated ? result.rows.slice(0, maxRows) : result.rows;

      // 컬럼 정보 추출
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      // 쿼리 히스토리 저장
      await this.saveQueryToHistory(dto.instanceId, dto.query, executionTime, result.rowCount, userId);

      // 감사 로그
      if (userId) {
        await this.auditService.logQueryExecution(
          userId,
          dto.instanceId,
          dto.query,
          true,
          executionTime,
        );
      }

      return {
        success: true,
        columns,
        rows,
        rowCount: result.rowCount,
        executionTime,
        truncated,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // 실패한 쿼리도 히스토리에 저장
      await this.saveQueryToHistory(dto.instanceId, dto.query, executionTime, 0, userId, error.message);

      // 감사 로그
      if (userId) {
        await this.auditService.logQueryExecution(
          userId,
          dto.instanceId,
          dto.query,
          false,
          executionTime,
        );
      }

      this.logger.error(`Query execution failed: ${error.message}`);

      return {
        success: false,
        executionTime,
        error: error.message,
      };
    }
  }

  async explainQuery(
    instanceId: string,
    query: string,
    options: { analyze?: boolean; buffers?: boolean; format?: 'text' | 'json' } = {},
  ): Promise<any> {
    const explainParts = ['EXPLAIN'];

    if (options.analyze) {
      explainParts.push('ANALYZE');
    }
    if (options.buffers) {
      explainParts.push('BUFFERS');
    }
    if (options.format === 'json') {
      explainParts.push('(FORMAT JSON)');
    }

    const explainQuery = `${explainParts.join(' ')} ${query}`;

    try {
      const result = await this.connectionManager.executeQuery(instanceId, explainQuery);

      if (options.format === 'json') {
        return {
          success: true,
          plan: result.rows[0]?.['QUERY PLAN'] || result.rows,
          format: 'json',
        };
      }

      return {
        success: true,
        plan: result.rows.map((row) => row['QUERY PLAN']).join('\n'),
        format: 'text',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============ Query History ============

  private async saveQueryToHistory(
    instanceId: string,
    query: string,
    executionTime: number,
    rowCount: number,
    userId?: string,
    error?: string,
  ): Promise<void> {
    try {
      const queryHash = crypto.createHash('md5').update(query).digest('hex');

      await this.prisma.queryHistory.create({
        data: {
          instanceId,
          query: query.substring(0, 10000), // 쿼리 길이 제한
          queryHash,
          durationMs: executionTime,
          rowsAffected: rowCount,
          userId,
          success: !error,
          errorMessage: error,
          startTime: new Date(Date.now() - executionTime),
          endTime: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to save query history: ${err.message}`);
    }
  }

  async getQueryHistory(filters: {
    instanceId?: string;
    userId?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ history: any[]; total: number }> {
    const where: any = {};

    if (filters.instanceId) {
      where.instanceId = filters.instanceId;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.success !== undefined) {
      where.success = filters.success;
    }

    const [history, total] = await Promise.all([
      this.prisma.queryHistory.findMany({
        where,
        include: {
          instance: {
            select: {
              id: true,
              name: true,
              host: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: { startTime: 'desc' },
        take: filters.limit || 100,
        skip: filters.offset || 0,
      }),
      this.prisma.queryHistory.count({ where }),
    ]);

    return { history, total };
  }

  // ============ Saved Queries ============

  async saveQuery(
    userId: string,
    data: {
      name: string;
      description?: string;
      query: string;
      instanceId?: string;
      isPublic?: boolean;
    },
  ): Promise<any> {
    return this.prisma.savedQuery.create({
      data: {
        name: data.name,
        description: data.description,
        query: data.query,
        instanceId: data.instanceId,
        isPublic: data.isPublic || false,
        createdById: userId,
      },
    });
  }

  async getSavedQueries(userId: string, instanceId?: string): Promise<any[]> {
    return this.prisma.savedQuery.findMany({
      where: {
        OR: [{ createdById: userId }, { isPublic: true }],
        ...(instanceId ? { instanceId } : {}),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteSavedQuery(id: string, userId: string): Promise<void> {
    const query = await this.prisma.savedQuery.findUnique({
      where: { id },
    });

    if (!query) {
      throw new BadRequestException('저장된 쿼리를 찾을 수 없습니다');
    }

    if (query.createdById !== userId) {
      throw new BadRequestException('본인이 저장한 쿼리만 삭제할 수 있습니다');
    }

    await this.prisma.savedQuery.delete({
      where: { id },
    });
  }

  // ============ Auto-complete ============

  async getAutocompleteSuggestions(
    instanceId: string,
    prefix: string,
    context: 'table' | 'column' | 'schema' | 'function' | 'keyword',
  ): Promise<string[]> {
    const suggestions: string[] = [];

    try {
      switch (context) {
        case 'table': {
          const result = await this.connectionManager.executeQuery(
            instanceId,
            `SELECT schemaname || '.' || tablename as name
             FROM pg_tables
             WHERE tablename ILIKE $1 || '%'
             LIMIT 20`,
            [prefix],
          );
          suggestions.push(...result.rows.map((r) => r.name));
          break;
        }

        case 'column': {
          const result = await this.connectionManager.executeQuery(
            instanceId,
            `SELECT column_name as name
             FROM information_schema.columns
             WHERE column_name ILIKE $1 || '%'
             LIMIT 20`,
            [prefix],
          );
          suggestions.push(...result.rows.map((r) => r.name));
          break;
        }

        case 'schema': {
          const result = await this.connectionManager.executeQuery(
            instanceId,
            `SELECT schema_name as name
             FROM information_schema.schemata
             WHERE schema_name ILIKE $1 || '%'
             LIMIT 20`,
            [prefix],
          );
          suggestions.push(...result.rows.map((r) => r.name));
          break;
        }

        case 'function': {
          const result = await this.connectionManager.executeQuery(
            instanceId,
            `SELECT routine_name as name
             FROM information_schema.routines
             WHERE routine_name ILIKE $1 || '%'
             LIMIT 20`,
            [prefix],
          );
          suggestions.push(...result.rows.map((r) => r.name));
          break;
        }

        case 'keyword': {
          const keywords = [
            'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
            'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'ILIKE',
            'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'INTO',
            'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TABLE',
            'INDEX', 'VIEW', 'FUNCTION', 'TRIGGER', 'CONSTRAINT', 'PRIMARY', 'KEY',
            'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT', 'NULL', 'NOT NULL',
            'CASCADE', 'RESTRICT', 'AS', 'DISTINCT', 'ALL', 'UNION', 'INTERSECT',
            'EXCEPT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'COALESCE', 'NULLIF',
            'CAST', 'EXTRACT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ARRAY', 'JSON',
          ];
          suggestions.push(
            ...keywords.filter((k) => k.toLowerCase().startsWith(prefix.toLowerCase())),
          );
          break;
        }
      }
    } catch (error) {
      this.logger.warn(`Autocomplete failed: ${error.message}`);
    }

    return suggestions;
  }

  // ============ Query Formatting ============

  formatQuery(query: string): string {
    // 기본적인 SQL 포매팅
    let formatted = query
      .replace(/\s+/g, ' ')
      .trim()
      // 주요 키워드 앞에 줄바꿈
      .replace(/\b(SELECT|FROM|WHERE|AND|OR|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|OUTER JOIN|ON|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|UNION|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM)\b/gi, '\n$1')
      .trim();

    // 들여쓰기 적용
    const lines = formatted.split('\n');
    const indentedLines: string[] = [];
    let indentLevel = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // SELECT, INSERT, UPDATE, DELETE는 인덴트 레벨 0
      if (/^(SELECT|INSERT INTO|UPDATE|DELETE FROM)/i.test(trimmedLine)) {
        indentLevel = 0;
      }
      // FROM, WHERE, GROUP BY 등은 인덴트 레벨 1
      else if (/^(FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|SET|VALUES)/i.test(trimmedLine)) {
        indentLevel = 0;
      }
      // JOIN, AND, OR는 인덴트 레벨 1
      else if (/^(JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|AND|OR)/i.test(trimmedLine)) {
        indentLevel = 1;
      }

      const indent = '  '.repeat(indentLevel);
      indentedLines.push(indent + trimmedLine);
    }

    return indentedLines.join('\n');
  }
}
