import { IsString, IsOptional, IsEnum, IsBoolean, IsArray, IsUUID, IsDateString } from 'class-validator';
import { ScopeType, ResourceType, ActionType } from '@prisma/client';

export class CreateRoleDto {
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
}

export class UpdateRoleDto {
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
}

export class CreatePermissionDto {
  @IsUUID()
  roleId: string;

  @IsEnum(ResourceType)
  resource: ResourceType;

  @IsEnum(ActionType)
  action: ActionType;

  @IsOptional()
  conditions?: Record<string, any>;
}

export class AssignRoleDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  roleId: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class RevokeRoleDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  roleId: string;
}

export class BulkAssignRolesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];

  @IsUUID()
  roleId: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
