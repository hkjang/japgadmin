import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActionType, ResourceType, AuditEventType } from '@prisma/client';
import { Request } from 'express';

export interface AuditLogDto {
  userId?: string;
  eventType: AuditEventType;
  resourceType?: ResourceType;
  resourceId?: string;
  action?: ActionType;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  request?: Request;
}

export interface AuditQueryFilters {
  userId?: string;
  eventType?: AuditEventType;
  resourceType?: ResourceType;
  resourceId?: string;
  action?: ActionType;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============ Audit Logging ============

  async log(dto: AuditLogDto): Promise<any> {
    try {
      const auditEvent = await this.prisma.auditEvent.create({
        data: {
          userId: dto.userId,
          eventType: dto.eventType,
          resourceType: dto.resourceType,
          resourceId: dto.resourceId,
          action: dto.action,
          details: dto.details || {},
          ipAddress: dto.ipAddress || this.extractIpAddress(dto.request),
          userAgent: dto.userAgent || dto.request?.headers['user-agent'],
          timestamp: new Date(),
        },
      });

      return auditEvent;
    } catch (error) {
      // Audit 로깅 실패해도 앱 동작에 영향 주지 않음
      this.logger.error(`Failed to log audit event: ${error.message}`);
      return null;
    }
  }

  // 편의 메서드들
  async logLogin(userId: string, success: boolean, request?: Request, details?: Record<string, any>): Promise<void> {
    await this.log({
      userId,
      eventType: success ? AuditEventType.LOGIN : AuditEventType.LOGIN_FAILED,
      details: { success, ...details },
      request,
    });
  }

  async logLogout(userId: string, request?: Request): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.LOGOUT,
      request,
    });
  }

  async logResourceAccess(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    action: ActionType,
    request?: Request,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.RESOURCE_ACCESS,
      resourceType,
      resourceId,
      action,
      details,
      request,
    });
  }

  async logConfigChange(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    changes: Record<string, any>,
    request?: Request,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.CONFIG_CHANGE,
      resourceType,
      resourceId,
      action: ActionType.UPDATE,
      details: { changes },
      request,
    });
  }

  async logPermissionChange(
    userId: string,
    targetUserId: string,
    changes: Record<string, any>,
    request?: Request,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.PERMISSION_CHANGE,
      resourceType: ResourceType.USER,
      resourceId: targetUserId,
      action: ActionType.UPDATE,
      details: { targetUserId, changes },
      request,
    });
  }

  async logDataExport(
    userId: string,
    exportType: string,
    recordCount: number,
    request?: Request,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.DATA_EXPORT,
      details: { exportType, recordCount },
      request,
    });
  }

  async logQueryExecution(
    userId: string,
    instanceId: string,
    query: string,
    success: boolean,
    durationMs: number,
    request?: Request,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.QUERY_EXECUTED,
      resourceType: ResourceType.QUERY,
      resourceId: instanceId,
      action: ActionType.EXECUTE,
      details: {
        query: query.substring(0, 500), // 쿼리 일부만 저장
        success,
        durationMs,
      },
      request,
    });
  }

  // ============ Audit Query ============

  async getAuditLogs(filters: AuditQueryFilters): Promise<{ events: any[]; total: number }> {
    const where: any = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.eventType) {
      where.eventType = filters.eventType;
    }
    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }
    if (filters.resourceId) {
      where.resourceId = filters.resourceId;
    }
    if (filters.action) {
      where.action = filters.action;
    }
    if (filters.ipAddress) {
      where.ipAddress = filters.ipAddress;
    }
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.timestamp.lte = filters.endDate;
      }
    }

    const [events, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 100,
        skip: filters.offset || 0,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return { events, total };
  }

  async getAuditLog(id: string): Promise<any> {
    const event = await this.prisma.auditEvent.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!event) {
      throw new NotFoundException('감사 로그를 찾을 수 없습니다');
    }

    return event;
  }

  // ============ User Activity ============

  async getUserActivity(userId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.prisma.auditEvent.findMany({
      where: {
        userId,
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    // 이벤트 유형별 집계
    const eventTypeCounts = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 일별 활동 집계
    const dailyActivity = events.reduce((acc, event) => {
      const date = event.timestamp.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 리소스 접근 집계
    const resourceAccess = events
      .filter((e) => e.resourceType)
      .reduce((acc, event) => {
        const key = `${event.resourceType}:${event.resourceId}`;
        if (!acc[key]) {
          acc[key] = { resourceType: event.resourceType, resourceId: event.resourceId, count: 0 };
        }
        acc[key].count++;
        return acc;
      }, {} as Record<string, any>);

    return {
      userId,
      period: { startDate, endDate: new Date() },
      totalEvents: events.length,
      eventTypeCounts,
      dailyActivity,
      topResources: Object.values(resourceAccess)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10),
      recentEvents: events.slice(0, 20),
    };
  }

  // ============ Audit Statistics ============

  async getAuditStatistics(startDate?: Date, endDate?: Date): Promise<any> {
    const where: any = {};
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const [
      totalEvents,
      loginEvents,
      failedLogins,
      resourceAccessEvents,
      configChangeEvents,
    ] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.count({ where: { ...where, eventType: AuditEventType.LOGIN } }),
      this.prisma.auditEvent.count({ where: { ...where, eventType: AuditEventType.LOGIN_FAILED } }),
      this.prisma.auditEvent.count({ where: { ...where, eventType: AuditEventType.RESOURCE_ACCESS } }),
      this.prisma.auditEvent.count({ where: { ...where, eventType: AuditEventType.CONFIG_CHANGE } }),
    ]);

    // 시간별 이벤트 분포
    const hourlyDistribution = await this.prisma.$queryRaw`
      SELECT
        EXTRACT(HOUR FROM timestamp) as hour,
        COUNT(*) as count
      FROM "AuditEvent"
      WHERE timestamp >= COALESCE(${startDate}, timestamp)
        AND timestamp <= COALESCE(${endDate}, timestamp)
      GROUP BY EXTRACT(HOUR FROM timestamp)
      ORDER BY hour
    `;

    // 상위 사용자
    const topUsers = await this.prisma.auditEvent.groupBy({
      by: ['userId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // 상위 IP 주소
    const topIpAddresses = await this.prisma.auditEvent.groupBy({
      by: ['ipAddress'],
      where: { ...where, ipAddress: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    return {
      period: { startDate, endDate },
      summary: {
        totalEvents,
        loginEvents,
        failedLogins,
        loginFailureRate: loginEvents > 0 ? (failedLogins / (loginEvents + failedLogins)) * 100 : 0,
        resourceAccessEvents,
        configChangeEvents,
      },
      hourlyDistribution,
      topUsers,
      topIpAddresses,
    };
  }

  // ============ Security Alerts ============

  async detectSecurityAnomalies(): Promise<any[]> {
    const anomalies: any[] = [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // 1. 짧은 시간 내 다수의 로그인 실패
    const failedLoginCounts = await this.prisma.auditEvent.groupBy({
      by: ['ipAddress'],
      where: {
        eventType: AuditEventType.LOGIN_FAILED,
        timestamp: { gte: oneHourAgo },
      },
      _count: { id: true },
    });

    for (const item of failedLoginCounts) {
      if (item._count.id >= 5) {
        anomalies.push({
          type: 'BRUTE_FORCE_ATTEMPT',
          severity: 'high',
          ipAddress: item.ipAddress,
          failedAttempts: item._count.id,
          message: `IP ${item.ipAddress}에서 ${item._count.id}회 로그인 실패`,
        });
      }
    }

    // 2. 비정상적인 시간대 접근
    const lateNightAccess = await this.prisma.auditEvent.findMany({
      where: {
        timestamp: { gte: oneHourAgo },
        eventType: { in: [AuditEventType.LOGIN, AuditEventType.RESOURCE_ACCESS] },
      },
      select: {
        userId: true,
        timestamp: true,
        ipAddress: true,
      },
    });

    const suspiciousTimeAccess = lateNightAccess.filter((event) => {
      const hour = event.timestamp.getHours();
      return hour >= 0 && hour < 6; // 새벽 시간대
    });

    if (suspiciousTimeAccess.length > 0) {
      const uniqueUsers = [...new Set(suspiciousTimeAccess.map((e) => e.userId))];
      anomalies.push({
        type: 'UNUSUAL_TIME_ACCESS',
        severity: 'medium',
        users: uniqueUsers,
        accessCount: suspiciousTimeAccess.length,
        message: `새벽 시간대(00:00-06:00)에 ${uniqueUsers.length}명의 사용자가 접근`,
      });
    }

    // 3. 대량 데이터 내보내기
    const dataExports = await this.prisma.auditEvent.findMany({
      where: {
        eventType: AuditEventType.DATA_EXPORT,
        timestamp: { gte: oneHourAgo },
      },
    });

    const largeExports = dataExports.filter((event) => {
      const details = event.details as any;
      return details?.recordCount > 10000;
    });

    if (largeExports.length > 0) {
      anomalies.push({
        type: 'LARGE_DATA_EXPORT',
        severity: 'medium',
        exports: largeExports.length,
        message: `대량 데이터 내보내기 ${largeExports.length}건 감지`,
      });
    }

    return anomalies;
  }

  // ============ Compliance Report ============

  async generateComplianceReport(startDate: Date, endDate: Date): Promise<any> {
    const [stats, anomalies] = await Promise.all([
      this.getAuditStatistics(startDate, endDate),
      this.detectSecurityAnomalies(),
    ]);

    // 권한 변경 이력
    const permissionChanges = await this.prisma.auditEvent.findMany({
      where: {
        eventType: AuditEventType.PERMISSION_CHANGE,
        timestamp: { gte: startDate, lte: endDate },
      },
      include: {
        user: {
          select: { username: true },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    // 설정 변경 이력
    const configChanges = await this.prisma.auditEvent.findMany({
      where: {
        eventType: AuditEventType.CONFIG_CHANGE,
        timestamp: { gte: startDate, lte: endDate },
      },
      include: {
        user: {
          select: { username: true },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    // 데이터 접근 요약
    const dataAccessSummary = await this.prisma.auditEvent.groupBy({
      by: ['resourceType', 'action'],
      where: {
        eventType: AuditEventType.RESOURCE_ACCESS,
        timestamp: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
    });

    return {
      reportPeriod: { startDate, endDate },
      generatedAt: new Date(),
      summary: stats.summary,
      securityAnomalies: anomalies,
      permissionChanges: {
        total: permissionChanges.length,
        changes: permissionChanges.slice(0, 50),
      },
      configChanges: {
        total: configChanges.length,
        changes: configChanges.slice(0, 50),
      },
      dataAccessSummary,
      recommendations: this.generateRecommendations(stats, anomalies),
    };
  }

  private generateRecommendations(stats: any, anomalies: any[]): string[] {
    const recommendations: string[] = [];

    if (stats.summary.loginFailureRate > 10) {
      recommendations.push('로그인 실패율이 높습니다. 비밀번호 정책을 검토하세요.');
    }

    if (anomalies.some((a) => a.type === 'BRUTE_FORCE_ATTEMPT')) {
      recommendations.push('무차별 대입 공격 시도가 감지되었습니다. IP 차단을 고려하세요.');
    }

    if (anomalies.some((a) => a.type === 'UNUSUAL_TIME_ACCESS')) {
      recommendations.push('비정상적인 시간대 접근이 감지되었습니다. 해당 사용자의 활동을 검토하세요.');
    }

    if (stats.summary.configChangeEvents > 100) {
      recommendations.push('설정 변경이 빈번합니다. 변경 관리 프로세스를 검토하세요.');
    }

    return recommendations;
  }

  // ============ Helper Methods ============

  private extractIpAddress(request?: Request): string | undefined {
    if (!request) return undefined;

    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    }

    return request.ip;
  }

  // ============ Cleanup ============

  async cleanupOldAuditLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.auditEvent.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} audit logs older than ${retentionDays} days`);

    return result.count;
  }
}
