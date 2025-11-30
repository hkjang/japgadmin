import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AlertService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 알림 설정 조회
   */
  async getConfigs() {
    const configs = await this.prismaService.alertConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      count: configs.length,
      configs,
    };
  }

  /**
   * 알림 설정 생성
   */
  async createConfig(data: {
    name: string;
    alertType: string;
    threshold: number;
    enabled: boolean;
    webhookUrl?: string;
  }) {
    const config = await this.prismaService.alertConfig.create({
      data,
    });

    return config;
  }

  /**
   * 알림 설정 수정
   */
  async updateConfig(id: string, data: {
    threshold?: number;
    enabled?: boolean;
    webhookUrl?: string;
  }) {
    const config = await this.prismaService.alertConfig.update({
      where: { id },
      data,
    });

    return config;
  }

  /**
   * 알림 설정 삭제
   */
  async deleteConfig(id: string) {
    await this.prismaService.alertConfig.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * 알림 히스토리 조회
   */
  async getHistory(limit: number = 100) {
    const history = await this.prismaService.alertHistory.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return {
      count: history.length,
      history,
    };
  }

  /**
   * Slack 알림 전송
   */
  async sendSlackAlert(message: string, customWebhookUrl?: string) {
    const webhookUrl = customWebhookUrl || this.configService.get('SLACK_WEBHOOK_URL');

    if (!webhookUrl) {
      console.warn('Slack webhook URL is not configured');
      return { success: false, error: 'Webhook URL not configured' };
    }

    try {
      await axios.post(webhookUrl, {
        text: message,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `*PostgreSQL Admin Tool* | ${new Date().toISOString()}`,
              },
            ],
          },
        ],
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to send Slack alert:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 알림 히스토리 저장
   */
  async saveAlertHistory(
    alertType: string,
    targetDb: string,
    message: string,
    severity: 'info' | 'warning' | 'critical',
    notified: boolean,
  ) {
    await this.prismaService.alertHistory.create({
      data: {
        alertType,
        targetDb,
        message,
        severity,
        notified,
      },
    });
  }

  /**
   * 임계치 확인 및 알림 트리거
   */
  async checkThresholdAndAlert(
    alertType: string,
    currentValue: number,
    context: any,
  ) {
    // 활성화된 설정 조회
    const config = await this.prismaService.alertConfig.findFirst({
      where: {
        alertType,
        enabled: true,
      },
    });

    if (!config) {
      return;
    }

    // 임계치 초과 확인
    if (currentValue >= config.threshold) {
      const severity = currentValue >= config.threshold * 1.5 ? 'critical' : 'warning';
      const message = this.buildAlertMessage(alertType, currentValue, config.threshold, context);

      // Slack 알림 전송
      const result = await this.sendSlackAlert(message, config.webhookUrl);

      // 히스토리 저장
      await this.saveAlertHistory(
        alertType,
        context.targetDb || process.env.TARGET_DB_NAME || 'target_db',
        message,
        severity,
        result.success,
      );
    }
  }

  /**
   * 알림 메시지 생성
   */
  private buildAlertMessage(
    alertType: string,
    currentValue: number,
    threshold: number,
    context: any,
  ): string {
    const emoji = currentValue >= threshold * 1.5 ? '🔴' : '⚠️';
    
    let message = `${emoji} *${alertType.toUpperCase()} Alert*\n\n`;
    message += `Current Value: *${currentValue.toFixed(2)}*\n`;
    message += `Threshold: ${threshold}\n`;
    message += `Database: ${context.targetDb || 'N/A'}\n`;

    if (context.details) {
      message += `\nDetails:\n${JSON.stringify(context.details, null, 2)}`;
    }

    return message;
  }
}
