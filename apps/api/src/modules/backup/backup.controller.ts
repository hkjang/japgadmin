import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  BackupService,
  CreateBackupConfigDto,
  UpdateBackupConfigDto,
  CreateBackupDto,
} from './backup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ResourceType, ActionType, BackupStatus, BackupType } from '@prisma/client';
import { Response } from 'express';
import { Res } from '@nestjs/common';

@Controller('backups')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  // ============ Backup Configuration ============

  @Post('configs')
  @RequirePermission({ resource: ResourceType.BACKUP, action: ActionType.CREATE })
  async createBackupConfig(@Body() dto: CreateBackupConfigDto) {
    return this.backupService.createBackupConfig(dto);
  }

  @Get('configs')
  @RequirePermission({ resource: ResourceType.BACKUP, action: ActionType.VIEW })
  async getBackupConfigs(@Query('instanceId') instanceId?: string) {
    return this.backupService.getBackupConfigs(instanceId);
  }

  @Get('configs/:id')
  @RequirePermission({ resource: ResourceType.BACKUP, action: ActionType.VIEW })
  async getBackupConfig(@Param('id', ParseUUIDPipe) id: string) {
    return this.backupService.getBackupConfig(id);
  }

  @Put('configs/:id')
  @RequirePermission({ resource: ResourceType.BACKUP, action: ActionType.UPDATE })
  async updateBackupConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBackupConfigDto,
  ) {
    return this.backupService.updateBackupConfig(id, dto);
  }

  @Delete('configs/:id')
  @RequirePermission({ resource: ResourceType.BACKUP, action: ActionType.DELETE })
  async deleteBackupConfig(@Param('id', ParseUUIDPipe) id: string) {
    return this.backupService.deleteBackupConfig(id);
  }

  // ============ Backup Management ============

  @Post()
  @RequirePermission({ resource: ResourceType.BACKUP, action: ActionType.EXECUTE })
  async createBackup(@Body() dto: CreateBackupDto) {
    return this.backupService.createBackup(dto);
  }

  @Get()
  @RequirePermission({ resource: ResourceType.BACKUP, action: ActionType.VIEW })
  async getBackups(
    @Query('configId') configId?: string,
    @Query('instanceId') instanceId?: string,
    @Query('status') status?: BackupStatus,
    @Query('type') type?: BackupType,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.backupService.getBackups({
      configId,
      instanceId,
      status,
      type,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('statistics')
  @RequirePermission({ resource: ResourceType.BACKUP, action: ActionType.VIEW })
  async getBackupStatistics(@Query('instanceId') instanceId?: string) {
    return this.backupService.getBackupStatistics(instanceId);
  }

  @Get(':id')
  @RequirePermission({ resource: ResourceType.BACKUP, action: ActionType.VIEW })
  async getBackup(@Param('id', ParseUUIDPipe) id: string) {
    return this.backupService.getBackup(id);
  }

  @Delete(':id')
  @RequirePermission({ resource: ResourceType.BACKUP, action: ActionType.DELETE })
  async deleteBackup(@Param('id', ParseUUIDPipe) id: string) {
    return this.backupService.deleteBackup(id);
  }

  @Post(':id/restore')
  @RequirePermission({ resource: ResourceType.BACKUP, action: ActionType.EXECUTE })
  async restoreBackup(@Param('id', ParseUUIDPipe) id: string) {
    return this.backupService.restoreBackup(id);
  }

  @Get(':id/download')
  @RequirePermission({ resource: ResourceType.BACKUP, action: ActionType.VIEW })
  async downloadBackup(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { stream, filename } = await this.backupService.downloadBackup(id);
    
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    stream.pipe(res);
  }

  // ============ PITR ============

  @Get('pitr/:instanceId/range')
  @RequirePermission({ resource: ResourceType.BACKUP, action: ActionType.VIEW })
  async getPitrRange(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.backupService.getPitrRange(instanceId);
  }

  @Post('pitr/:instanceId/estimate')
  @RequirePermission({ resource: ResourceType.BACKUP, action: ActionType.VIEW })
  async estimateRecoveryTime(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body('targetTime') targetTime: string,
  ) {
    return this.backupService.estimateRecoveryTime(instanceId, new Date(targetTime));
  }
}
