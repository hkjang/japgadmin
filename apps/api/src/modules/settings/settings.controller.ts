import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ResourceType, ActionType } from '@prisma/client';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermission({ resource: ResourceType.CONFIG, action: ActionType.VIEW })
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Post()
  @RequirePermission({ resource: ResourceType.CONFIG, action: ActionType.UPDATE })
  async updateSettings(@Body() settings: Record<string, any>) {
    return this.settingsService.updateSettings(settings);
  }
}
