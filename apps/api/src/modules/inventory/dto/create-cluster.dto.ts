import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { Environment, CloudProvider } from '@prisma/client';

export class CreateClusterDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Environment)
  environment?: Environment;

  @IsOptional()
  @IsEnum(CloudProvider)
  cloudProvider?: CloudProvider;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsObject()
  tags?: Record<string, string>;
}

export class UpdateClusterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Environment)
  environment?: Environment;

  @IsOptional()
  @IsEnum(CloudProvider)
  cloudProvider?: CloudProvider;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsObject()
  tags?: Record<string, string>;
}
