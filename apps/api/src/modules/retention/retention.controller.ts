import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { RetentionService, CreateRetentionPolicyDto } from './retention.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ResourceType, ActionType } from '@prisma/client';

@Controller('retention')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Post()
  @RequirePermission({ resource: ResourceType.CONFIG, action: ActionType.CREATE })
  async createPolicy(
    @Body() dto: CreateRetentionPolicyDto,
    @CurrentUser() user: any,
  ) {
    return this.retentionService.createPolicy(dto, user?.id);
  }

  @Get()
  @RequirePermission({ resource: ResourceType.CONFIG, action: ActionType.VIEW })
  async getPolicies(@Query('instanceId') instanceId: string) {
    return this.retentionService.getPolicies(instanceId);
  }

  @Delete(':id')
  @RequirePermission({ resource: ResourceType.CONFIG, action: ActionType.DELETE })
  async deletePolicy(@Param('id', ParseUUIDPipe) id: string) {
    return this.retentionService.deletePolicy(id);
  }
}
