import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { RetentionService, CreateRetentionPolicyDto, UpdateRetentionPolicyDto } from './retention.service';
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

  async deletePolicy(@Param('id', ParseUUIDPipe) id: string) {
    return this.retentionService.deletePolicy(id);
  }

  @Post(':id/run')
  @RequirePermission({ resource: ResourceType.CONFIG, action: ActionType.EXECUTE })
  async runPolicy(@Param('id', ParseUUIDPipe) id: string) {
    return this.retentionService.triggerPolicy(id);
  }

  @Put(':id')
  @RequirePermission({ resource: ResourceType.CONFIG, action: ActionType.UPDATE })
  async updatePolicy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRetentionPolicyDto,
  ) {
    return this.retentionService.updatePolicy(id, dto);
  }
}
