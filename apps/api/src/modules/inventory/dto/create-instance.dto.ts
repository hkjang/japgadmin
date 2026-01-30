import { IsString, IsOptional, IsEnum, IsInt, IsArray, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { InstanceRole, ConnectionMode, SslMode } from '@prisma/client';

export class CreateInstanceDto {
  @IsUUID()
  clusterId: string;

  @IsString()
  name: string;

  @IsString()
  host: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  port?: number = 5432;

  @IsOptional()
  @IsEnum(InstanceRole)
  role?: InstanceRole;

  @IsOptional()
  @IsString()
  pgVersion?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extensions?: string[];

  @IsOptional()
  @IsEnum(ConnectionMode)
  connectionMode?: ConnectionMode;

  @IsOptional()
  @IsEnum(SslMode)
  sslMode?: SslMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  maxConnections?: number = 10;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(60000)
  @Type(() => Number)
  connectionTimeout?: number = 5000;

  @IsOptional()
  @IsUUID()
  credentialId?: string;
}

export class UpdateInstanceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  port?: number;

  @IsOptional()
  @IsEnum(InstanceRole)
  role?: InstanceRole;

  @IsOptional()
  @IsString()
  pgVersion?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extensions?: string[];

  @IsOptional()
  @IsEnum(ConnectionMode)
  connectionMode?: ConnectionMode;

  @IsOptional()
  @IsEnum(SslMode)
  sslMode?: SslMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  maxConnections?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(60000)
  @Type(() => Number)
  connectionTimeout?: number;

  @IsOptional()
  @IsUUID()
  credentialId?: string;
}

export class TestConnectionDto {
  @IsString()
  host: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  port: number;

  @IsOptional()
  @IsString()
  database?: string;

  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsEnum(SslMode)
  sslMode?: SslMode;
}
