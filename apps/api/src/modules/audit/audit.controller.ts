import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuditService, AuditQueryFilters } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ResourceType, ActionType, AuditEventType } from '@prisma/client';

@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // ============ Audit Logs ============

  @Get('logs')
  @RequirePermission({ resource: ResourceType.AUDIT_LOG, action: ActionType.VIEW })
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('eventType') eventType?: AuditEventType,
    @Query('resourceType') resourceType?: ResourceType,
    @Query('resourceId') resourceId?: string,
    @Query('action') action?: ActionType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('ipAddress') ipAddress?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filters: AuditQueryFilters = {
      userId,
      eventType,
      resourceType,
      resourceId,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      ipAddress,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    };

    return this.auditService.getAuditLogs(filters);
  }

  @Get('logs/:id')
  @RequirePermission({ resource: ResourceType.AUDIT_LOG, action: ActionType.VIEW })
  async getAuditLog(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditService.getAuditLog(id);
  }

  // ============ User Activity ============

  @Get('users/:userId/activity')
  @RequirePermission({ resource: ResourceType.AUDIT_LOG, action: ActionType.VIEW })
  async getUserActivity(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('days') days?: string,
  ) {
    return this.auditService.getUserActivity(userId, days ? parseInt(days, 10) : undefined);
  }

  // ============ Statistics ============

  @Get('statistics')
  @RequirePermission({ resource: ResourceType.AUDIT_LOG, action: ActionType.VIEW })
  async getAuditStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getAuditStatistics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // ============ Security ============

  @Get('security/anomalies')
  @RequirePermission({ resource: ResourceType.AUDIT_LOG, action: ActionType.VIEW })
  async detectSecurityAnomalies() {
    return this.auditService.detectSecurityAnomalies();
  }

  // ============ Compliance Report ============

  @Get('compliance/report')
  @RequirePermission({ resource: ResourceType.AUDIT_LOG, action: ActionType.VIEW })
  async generateComplianceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.auditService.generateComplianceReport(
      new Date(startDate),
      new Date(endDate),
    );
  }
}
