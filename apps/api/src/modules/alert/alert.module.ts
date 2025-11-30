import { Module } from '@nestjs/common';
import { AlertController } from './alert.controller';
import { AlertService } from './alert.service';
import { AlertScheduler } from './alert.scheduler';
import { MonitoringService } from '../monitoring/monitoring.service';
import { PostgresService } from '../../database/postgres.service';

@Module({
  controllers: [AlertController],
  providers: [AlertService, AlertScheduler, MonitoringService, PostgresService],
  exports: [AlertService],
})
export class AlertModule {}
