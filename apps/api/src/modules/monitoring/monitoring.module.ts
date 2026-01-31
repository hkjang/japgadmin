import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { MonitoringScheduler } from './monitoring.scheduler';
import { PostgresService } from '../../database/postgres.service';

@Module({
  controllers: [MonitoringController],
  providers: [MonitoringService, MonitoringScheduler, PostgresService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
