import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class CreateDatabaseDto {
  @IsUUID()
  instanceId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsString()
  encoding?: string;

  @IsOptional()
  @IsString()
  collation?: string;

  @IsOptional()
  @IsBoolean()
  readOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;
}

export class UpdateDatabaseDto {
  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsBoolean()
  readOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;
}
