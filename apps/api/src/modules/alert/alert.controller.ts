import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { AlertService } from './alert.service';

@Controller('alert')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Get('configs')
  async getConfigs() {
    return this.alertService.getConfigs();
  }

  @Post('configs')
  async createConfig(@Body() body: {
    name: string;
    alertType: string;
    threshold: number;
    enabled: boolean;
    webhookUrl?: string;
  }) {
    return this.alertService.createConfig(body);
  }

  @Put('configs/:id')
  async updateConfig(
    @Param('id') id: string,
    @Body() body: {
      threshold?: number;
      enabled?: boolean;
      webhookUrl?: string;
    },
  ) {
    return this.alertService.updateConfig(id, body);
  }

  @Delete('configs/:id')
  async deleteConfig(@Param('id') id: string) {
    return this.alertService.deleteConfig(id);
  }

  @Get('history')
  async getHistory() {
    return this.alertService.getHistory();
  }

  @Post('test')
  async testAlert(@Body() body: { message: string; webhookUrl?: string }) {
    return this.alertService.sendSlackAlert(body.message, body.webhookUrl);
  }
}
