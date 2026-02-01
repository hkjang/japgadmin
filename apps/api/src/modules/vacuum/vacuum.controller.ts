import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { VacuumService } from './vacuum.service';

@Controller('vacuum')
export class VacuumController {
  constructor(private readonly vacuumService: VacuumService) {}

  @Post('execute')
  async executeVacuum(@Body() body: { 
    tableName: string; 
    vacuumType: 'VACUUM' | 'VACUUM FULL' | 'ANALYZE';
    verbose?: boolean;
  }) {
    return this.vacuumService.executeVacuum(
      body.tableName,
      body.vacuumType,
      body.verbose,
    );
  }

  @Get('history')
  async getHistory(
    @Query('limit') limit?: string,
    @Query('tableName') tableName?: string,
  ) {
    return this.vacuumService.getHistory(
      parseInt(limit || '50'),
      tableName,
    );
  }

  @Get('autovacuum')
  async getAutovacuumStats() {
    return this.vacuumService.getAutovacuumStats();
  }

  @Get('table-stats')
  async getTableVacuumStats() {
    return this.vacuumService.getTableVacuumStats();
  }

  @Get('settings/global')
  async getGlobalSettings() {
    return this.vacuumService.getGlobalSettings();
  }

  @Get('settings/table')
  async getTableSettings(@Query('tableName') tableName: string) {
    return this.vacuumService.getTableSettings(tableName);
  }

  @Post('settings/table')
  async updateTableSettings(@Body() body: { tableName: string; settings: Record<string, string | null> }) {
    return this.vacuumService.updateTableSettings(body.tableName, body.settings);
  }
}
