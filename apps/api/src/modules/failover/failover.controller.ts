import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { FailoverService, ManualFailoverDto, FailoverConfig } from './failover.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ResourceType, ActionType, FailoverStatus } from '@prisma/client';

@Controller('failover')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FailoverController {
  constructor(private readonly failoverService: FailoverService) {}

  // ============ Failover Readiness ============

  @Get('clusters/:clusterId/readiness')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.VIEW })
  async checkFailoverReadiness(@Param('clusterId', ParseUUIDPipe) clusterId: string) {
    return this.failoverService.checkFailoverReadiness(clusterId);
  }

  // ============ Failover Operations ============

  @Post()
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.EXECUTE })
  async initiateFailover(@Body() dto: ManualFailoverDto) {
    return this.failoverService.initiateFailover(dto);
  }

  @Post('switchover')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.EXECUTE })
  async initiateSwitchover(
    @Body('clusterId', ParseUUIDPipe) clusterId: string,
    @Body('newPrimaryId', ParseUUIDPipe) newPrimaryId: string,
  ) {
    return this.failoverService.initiateSwitchover(clusterId, newPrimaryId);
  }

  // ============ Failover History ============

  @Get('history')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.VIEW })
  async getFailoverHistory(
    @Query('clusterId') clusterId?: string,
    @Query('status') status?: FailoverStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.failoverService.getFailoverHistory({
      clusterId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('history/:id')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.VIEW })
  async getFailover(@Param('id', ParseUUIDPipe) id: string) {
    return this.failoverService.getFailover(id);
  }

  // ============ Auto Failover Configuration ============

  @Get('clusters/:clusterId/config')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.VIEW })
  async getAutoFailoverConfig(@Param('clusterId', ParseUUIDPipe) clusterId: string) {
    return this.failoverService.getAutoFailoverConfig(clusterId);
  }

  @Put('clusters/:clusterId/config')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.UPDATE })
  async updateAutoFailoverConfig(
    @Param('clusterId', ParseUUIDPipe) clusterId: string,
    @Body() config: Omit<FailoverConfig, 'clusterId'>,
  ) {
    return this.failoverService.updateAutoFailoverConfig({ clusterId, ...config });
  }
}
