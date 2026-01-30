import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsObject,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CredentialType, ScopeType, SqlRuleType, RuleAction, MaskingType } from '@prisma/client';

// ==================== CREDENTIAL DTOs ====================

export class CreateCredentialDto {
  @IsString()
  name: string;

  @IsEnum(CredentialType)
  type: CredentialType;

  @IsObject()
  data: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  rotationEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  rotationDays?: number;
}

export class UpdateCredentialDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  rotationEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  rotationDays?: number;
}

// ==================== SQL SAFETY RULE DTOs ====================

export class CreateSqlSafetyRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ScopeType)
  scopeType?: ScopeType;

  @IsOptional()
  @IsString()
  scopeId?: string;

  @IsEnum(SqlRuleType)
  ruleType: SqlRuleType;

  @IsOptional()
  @IsString()
  pattern?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxRowsAffected?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Type(() => Number)
  maxExecutionTime?: number;

  @IsOptional()
  @IsBoolean()
  forceExplain?: boolean;

  @IsOptional()
  @IsEnum(RuleAction)
  action?: RuleAction;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  priority?: number;
}

export class UpdateSqlSafetyRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ScopeType)
  scopeType?: ScopeType;

  @IsOptional()
  @IsString()
  scopeId?: string;

  @IsOptional()
  @IsString()
  pattern?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxRowsAffected?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Type(() => Number)
  maxExecutionTime?: number;

  @IsOptional()
  @IsBoolean()
  forceExplain?: boolean;

  @IsOptional()
  @IsEnum(RuleAction)
  action?: RuleAction;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  priority?: number;
}

// ==================== DATA MASKING RULE DTOs ====================

export class CreateDataMaskingRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  databaseId?: string;

  @IsOptional()
  @IsString()
  schemaPattern?: string;

  @IsOptional()
  @IsString()
  tablePattern?: string;

  @IsOptional()
  @IsString()
  columnPattern?: string;

  @IsEnum(MaskingType)
  maskingType: MaskingType;

  @IsOptional()
  @IsString()
  customPattern?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exemptRoleIds?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateDataMaskingRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  schemaPattern?: string;

  @IsOptional()
  @IsString()
  tablePattern?: string;

  @IsOptional()
  @IsString()
  columnPattern?: string;

  @IsOptional()
  @IsEnum(MaskingType)
  maskingType?: MaskingType;

  @IsOptional()
  @IsString()
  customPattern?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exemptRoleIds?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

// ==================== SQL VALIDATION DTOs ====================

export class ValidateSqlDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  instanceId?: string;

  @IsOptional()
  @IsString()
  databaseId?: string;

  @IsOptional()
  @IsBoolean()
  isReadOnly?: boolean;
}
