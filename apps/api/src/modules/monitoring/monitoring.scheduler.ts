import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonitoringService } from './monitoring.service';

@Injectable()
export class MonitoringScheduler {
  private readonly logger = new Logger(MonitoringScheduler.name);

  constructor(private readonly monitoringService: MonitoringService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async collectMetrics() {
    this.logger.debug('Collecting monitoring metrics...');
    try {
      await Promise.all([
        this.monitoringService.getDatabaseStats(),
        this.monitoringService.getConnectionStats(),
        this.monitoringService.getActivity(),
        // Table sizes might be heavy, maybe run less frequently? 
        // But for now, let's keep it simple or maybe every 5 mins.
        // sticking to plan: collect main stats every minute.
      ]);
    } catch (error) {
      this.logger.error('Failed to collect metrics', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async collectHeavyMetrics() {
    this.logger.debug('Collecting heavy monitoring metrics (table sizes)...');
    try {
        await this.monitoringService.getTableSizes();
    } catch (error) {
        this.logger.error('Failed to collect heavy metrics', error);
    }
  }
}
