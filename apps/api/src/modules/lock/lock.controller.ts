import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { LockService } from './lock.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ResourceType, ActionType } from '@prisma/client';

@Controller('instances/:instanceId/locks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LockController {
  constructor(private readonly lockService: LockService) {}

  @Get()
  @RequirePermission({ resource: ResourceType.SESSION, action: ActionType.VIEW })
  async getLocks(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Query('granted') granted?: string,
    @Query('locktype') locktype?: string,
    @Query('pid') pid?: string,
  ) {
    return this.lockService.getLocks(instanceId, {
      granted: granted !== undefined ? granted === 'true' : undefined,
      locktype,
      pid: pid ? parseInt(pid, 10) : undefined,
    });
  }

  @Get('waiting')
  @RequirePermission({ resource: ResourceType.SESSION, action: ActionType.VIEW })
  async getWaitingLocks(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.lockService.getWaitingLocks(instanceId);
  }

  @Get('stats')
  @RequirePermission({ resource: ResourceType.SESSION, action: ActionType.VIEW })
  async getLockStats(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.lockService.getLockStats(instanceId);
  }

  @Get('blocking-tree')
  @RequirePermission({ resource: ResourceType.SESSION, action: ActionType.VIEW })
  async getBlockingTree(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.lockService.getBlockingTree(instanceId);
  }

  @Get('deadlocks')
  @RequirePermission({ resource: ResourceType.SESSION, action: ActionType.VIEW })
  async detectDeadlocks(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.lockService.detectDeadlocks(instanceId);
  }

  @Get('table-conflicts')
  @RequirePermission({ resource: ResourceType.SESSION, action: ActionType.VIEW })
  async getTableLockConflicts(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.lockService.getTableLockConflicts(instanceId);
  }
}
