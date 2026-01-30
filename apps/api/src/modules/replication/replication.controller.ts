import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ReplicationService } from './replication.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ResourceType, ActionType } from '@prisma/client';

@Controller('replication')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReplicationController {
  constructor(private readonly replicationService: ReplicationService) {}

  // ============ Replication Status ============

  @Get('instances/:instanceId/status')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.VIEW })
  async getReplicationStatus(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.replicationService.getReplicationStatus(instanceId);
  }

  @Get('instances/:instanceId/standbys')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.VIEW })
  async getStandbyList(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.replicationService.getStandbyList(instanceId);
  }

  @Get('instances/:instanceId/slots')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.VIEW })
  async getReplicationSlots(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.replicationService.getReplicationSlots(instanceId);
  }

  @Get('instances/:instanceId/health')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.VIEW })
  async checkReplicationHealth(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.replicationService.checkReplicationHealth(instanceId);
  }

  // ============ Cluster Topology ============

  @Get('clusters/:clusterId/topology')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.VIEW })
  async getClusterTopology(@Param('clusterId', ParseUUIDPipe) clusterId: string) {
    return this.replicationService.getClusterTopology(clusterId);
  }

  // ============ Replication Slot Management ============

  @Post('instances/:instanceId/slots')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.EXECUTE })
  async createReplicationSlot(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body('slotName') slotName: string,
    @Body('isLogical') isLogical?: boolean,
  ) {
    return this.replicationService.createReplicationSlot(instanceId, slotName, isLogical);
  }

  @Delete('instances/:instanceId/slots/:slotName')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.EXECUTE })
  async dropReplicationSlot(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('slotName') slotName: string,
  ) {
    return this.replicationService.dropReplicationSlot(instanceId, slotName);
  }

  // ============ WAL Management ============

  @Post('instances/:instanceId/wal/pause')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.EXECUTE })
  async pauseWalReplay(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.replicationService.pauseWalReplay(instanceId);
  }

  @Post('instances/:instanceId/wal/resume')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.EXECUTE })
  async resumeWalReplay(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.replicationService.resumeWalReplay(instanceId);
  }

  @Post('instances/:instanceId/wal/switch')
  @RequirePermission({ resource: ResourceType.CLUSTER, action: ActionType.EXECUTE })
  async switchWal(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.replicationService.switchWal(instanceId);
  }
}
