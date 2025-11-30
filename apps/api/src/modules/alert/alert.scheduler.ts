import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertService } from './alert.service';
import { MonitoringService } from '../monitoring/monitoring.service';

@Injectable()
export class AlertScheduler {
  constructor(
    private readonly alertService: AlertService,
    private readonly monitoringService: MonitoringService,
  ) {}

  /**
   * 매 1분마다 연결 수 모니터링
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkConnections() {
    try {
      const stats = await this.monitoringService.getConnectionStats();
      const usagePercentage = parseFloat(stats.connections.usage_percentage);

      await this.alertService.checkThresholdAndAlert(
        'connection',
        usagePercentage,
        {
          targetDb: process.env.TARGET_DB_NAME,
          details: stats.connections,
        },
      );
    } catch (error) {
      console.error('Error checking connections:', error.message);
    }
  }

  /**
   * 매 5분마다 Dead Tuple 모니터링
   */
  @Cron('*/5 * * * *')
  async checkDeadTuples() {
    try {
      const stats = await this.monitoringService.getActivity(10);
      // Dead tuple percentage 체크 로직 추가 가능
    } catch (error) {
      console.error('Error checking dead tuples:', error.message);
    }
  }
}
