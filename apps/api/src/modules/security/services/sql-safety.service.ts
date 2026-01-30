import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SqlSafetyRule, ScopeType, SqlRuleType, RuleAction } from '@prisma/client';

export interface SqlValidationContext {
  userId?: string;
  instanceId?: string;
  databaseId?: string;
  environment?: string;
  isReadOnly?: boolean;
}

export interface SqlViolation {
  ruleId: string;
  ruleName: string;
  ruleType: SqlRuleType;
  action: RuleAction;
  message: string;
  details?: any;
}

export interface SqlValidationResult {
  valid: boolean;
  violations: SqlViolation[];
  warnings: SqlViolation[];
  modifiedQuery?: string;
}

@Injectable()
export class SqlSafetyService {
  private readonly logger = new Logger(SqlSafetyService.name);

  // Default forbidden keywords for DDL/DML protection
  private readonly DEFAULT_FORBIDDEN_DDL = [
    'DROP',
    'TRUNCATE',
    'ALTER',
    'CREATE',
    'GRANT',
    'REVOKE',
  ];

  private readonly DEFAULT_FORBIDDEN_PATTERNS = [
    /;\s*(DROP|TRUNCATE|DELETE\s+FROM)\s/i, // SQL injection patterns
    /--.*$/gm, // SQL comments (potential injection)
    /\/\*[\s\S]*?\*\//g, // Block comments
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate a SQL query against safety rules
   */
  async validateQuery(
    query: string,
    context: SqlValidationContext,
  ): Promise<SqlValidationResult> {
    const rules = await this.getApplicableRules(context);
    const violations: SqlViolation[] = [];
    const warnings: SqlViolation[] = [];

    // Normalize query for analysis
    const normalizedQuery = this.normalizeQuery(query);

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const violation = await this.checkRule(normalizedQuery, rule, context);

      if (violation) {
        if (violation.action === RuleAction.BLOCK) {
          violations.push(violation);
        } else if (violation.action === RuleAction.WARN || violation.action === RuleAction.AUDIT_ONLY) {
          warnings.push(violation);
        } else if (violation.action === RuleAction.REQUIRE_APPROVAL) {
          // For now, treat as blocking - approval workflow would be handled separately
          violations.push({
            ...violation,
            message: `${violation.message} (승인 필요)`,
          });
        }
      }
    }

    // Check for default protections even if no rules defined
    if (rules.length === 0 || context.isReadOnly) {
      const defaultViolations = this.checkDefaultProtections(normalizedQuery, context);
      violations.push(...defaultViolations);
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Get applicable rules for the given context
   */
  private async getApplicableRules(context: SqlValidationContext): Promise<SqlSafetyRule[]> {
    const rules = await this.prisma.sqlSafetyRule.findMany({
      where: {
        enabled: true,
        OR: [
          { scopeType: ScopeType.GLOBAL },
          { scopeType: ScopeType.CLUSTER, scopeId: context.instanceId },
          { scopeType: ScopeType.DATABASE, scopeId: context.databaseId },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    return rules;
  }

  /**
   * Check a single rule against the query
   */
  private async checkRule(
    query: string,
    rule: SqlSafetyRule,
    context: SqlValidationContext,
  ): Promise<SqlViolation | null> {
    switch (rule.ruleType) {
      case SqlRuleType.FORBIDDEN_KEYWORD:
        return this.checkForbiddenKeywords(query, rule);

      case SqlRuleType.FORBIDDEN_PATTERN:
        return this.checkForbiddenPattern(query, rule);

      case SqlRuleType.WRITE_RESTRICTION:
        return this.checkWriteRestriction(query, rule, context);

      case SqlRuleType.DDL_RESTRICTION:
        return this.checkDdlRestriction(query, rule);

      case SqlRuleType.ROW_LIMIT:
        // Row limit is handled by modifying the query, not validation
        return null;

      case SqlRuleType.EXECUTION_TIMEOUT:
        // Timeout is handled at execution time
        return null;

      default:
        return null;
    }
  }

  /**
   * Check for forbidden keywords
   */
  private checkForbiddenKeywords(query: string, rule: SqlSafetyRule): SqlViolation | null {
    const keywords = (rule.keywords as string[]) || this.DEFAULT_FORBIDDEN_DDL;

    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(query)) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.ruleType,
          action: rule.action,
          message: `금지된 키워드가 포함되어 있습니다: ${keyword}`,
          details: { keyword },
        };
      }
    }

    return null;
  }

  /**
   * Check for forbidden patterns (regex)
   */
  private checkForbiddenPattern(query: string, rule: SqlSafetyRule): SqlViolation | null {
    if (!rule.pattern) return null;

    try {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(query)) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.ruleType,
          action: rule.action,
          message: `금지된 패턴이 감지되었습니다: ${rule.name}`,
          details: { pattern: rule.pattern },
        };
      }
    } catch (e) {
      this.logger.warn(`Invalid regex pattern in rule ${rule.id}: ${rule.pattern}`);
    }

    return null;
  }

  /**
   * Check for write operations (INSERT, UPDATE, DELETE)
   */
  private checkWriteRestriction(
    query: string,
    rule: SqlSafetyRule,
    context: SqlValidationContext,
  ): SqlViolation | null {
    if (context.isReadOnly) {
      const writePatterns = [
        /\bINSERT\s+INTO\b/i,
        /\bUPDATE\s+\w+\s+SET\b/i,
        /\bDELETE\s+FROM\b/i,
      ];

      for (const pattern of writePatterns) {
        if (pattern.test(query)) {
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.ruleType,
            action: rule.action,
            message: '읽기 전용 모드에서는 쓰기 작업을 수행할 수 없습니다.',
            details: { operation: pattern.toString() },
          };
        }
      }
    }

    return null;
  }

  /**
   * Check for DDL operations
   */
  private checkDdlRestriction(query: string, rule: SqlSafetyRule): SqlViolation | null {
    const ddlPatterns = [
      /\bCREATE\s+(TABLE|INDEX|VIEW|FUNCTION|PROCEDURE|TRIGGER|DATABASE|SCHEMA)\b/i,
      /\bALTER\s+(TABLE|INDEX|VIEW|FUNCTION|PROCEDURE|TRIGGER|DATABASE|SCHEMA)\b/i,
      /\bDROP\s+(TABLE|INDEX|VIEW|FUNCTION|PROCEDURE|TRIGGER|DATABASE|SCHEMA)\b/i,
      /\bTRUNCATE\s+(TABLE)?\b/i,
    ];

    for (const pattern of ddlPatterns) {
      if (pattern.test(query)) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.ruleType,
          action: rule.action,
          message: 'DDL 작업이 제한되어 있습니다.',
          details: { operation: pattern.toString() },
        };
      }
    }

    return null;
  }

  /**
   * Check default protections when no rules defined
   */
  private checkDefaultProtections(
    query: string,
    context: SqlValidationContext,
  ): SqlViolation[] {
    const violations: SqlViolation[] = [];

    // Check for SQL injection patterns
    for (const pattern of this.DEFAULT_FORBIDDEN_PATTERNS) {
      if (pattern.test(query)) {
        violations.push({
          ruleId: 'default',
          ruleName: 'SQL Injection Protection',
          ruleType: SqlRuleType.FORBIDDEN_PATTERN,
          action: RuleAction.BLOCK,
          message: '잠재적인 SQL 인젝션 패턴이 감지되었습니다.',
          details: { pattern: pattern.toString() },
        });
      }
    }

    // In read-only mode, block all writes
    if (context.isReadOnly) {
      const writePatterns = [
        /\bINSERT\s+INTO\b/i,
        /\bUPDATE\s+\w+\s+SET\b/i,
        /\bDELETE\s+FROM\b/i,
      ];

      for (const pattern of writePatterns) {
        if (pattern.test(query)) {
          violations.push({
            ruleId: 'default',
            ruleName: 'Read-Only Mode',
            ruleType: SqlRuleType.WRITE_RESTRICTION,
            action: RuleAction.BLOCK,
            message: '읽기 전용 모드에서는 쓰기 작업을 수행할 수 없습니다.',
          });
          break;
        }
      }
    }

    return violations;
  }

  /**
   * Normalize query for consistent analysis
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  /**
   * Wrap query with safety limits
   */
  wrapWithLimits(
    query: string,
    options: { rowLimit?: number; timeout?: number },
  ): { query: string; preStatements: string[] } {
    const preStatements: string[] = [];
    let modifiedQuery = query;

    // Add timeout
    if (options.timeout) {
      preStatements.push(`SET statement_timeout = ${options.timeout}`);
    }

    // Add row limit if it's a SELECT and doesn't already have LIMIT
    if (
      options.rowLimit &&
      this.isSelectQuery(query) &&
      !query.toLowerCase().includes(' limit ')
    ) {
      modifiedQuery = `${query.trim()} LIMIT ${options.rowLimit}`;
    }

    return { query: modifiedQuery, preStatements };
  }

  /**
   * Check if query is a SELECT query
   */
  private isSelectQuery(query: string): boolean {
    const trimmed = query.trim().toLowerCase();
    return trimmed.startsWith('select') || trimmed.startsWith('with');
  }

  /**
   * Get query type
   */
  getQueryType(query: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL' | 'OTHER' {
    const trimmed = query.trim().toLowerCase();

    if (trimmed.startsWith('select') || trimmed.startsWith('with')) return 'SELECT';
    if (trimmed.startsWith('insert')) return 'INSERT';
    if (trimmed.startsWith('update')) return 'UPDATE';
    if (trimmed.startsWith('delete')) return 'DELETE';

    if (
      trimmed.startsWith('create') ||
      trimmed.startsWith('alter') ||
      trimmed.startsWith('drop') ||
      trimmed.startsWith('truncate')
    ) {
      return 'DDL';
    }

    return 'OTHER';
  }

  /**
   * Validate and throw if invalid
   */
  async validateOrThrow(query: string, context: SqlValidationContext): Promise<void> {
    const result = await this.validateQuery(query, context);

    if (!result.valid) {
      const messages = result.violations.map((v) => v.message).join('; ');
      throw new BadRequestException(`SQL 검증 실패: ${messages}`);
    }
  }
}
