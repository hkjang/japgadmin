import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ResourceType, ActionType } from '@prisma/client';

@Controller('instances/:instanceId/sessions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  @RequirePermission({ resource: ResourceType.SESSION, action: ActionType.VIEW })
  async getActiveSessions(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Query('state') state?: string,
    @Query('username') username?: string,
    @Query('database') database?: string,
    @Query('minDurationMs') minDurationMs?: string,
    @Query('excludeIdle') excludeIdle?: string,
  ) {
    return this.sessionService.getActiveSessions(instanceId, {
      state,
      username,
      database,
      minDurationMs: minDurationMs ? parseInt(minDurationMs, 10) : undefined,
      excludeIdle: excludeIdle === 'true',
    });
  }

  @Get('stats')
  @RequirePermission({ resource: ResourceType.SESSION, action: ActionType.VIEW })
  async getSessionStats(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.sessionService.getSessionStats(instanceId);
  }

  @Get('blocking')
  @RequirePermission({ resource: ResourceType.SESSION, action: ActionType.VIEW })
  async getBlockingSessions(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.sessionService.getBlockingSessions(instanceId);
  }

  @Get(':pid')
  @RequirePermission({ resource: ResourceType.SESSION, action: ActionType.VIEW })
  async getSessionByPid(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('pid', ParseIntPipe) pid: number,
  ) {
    return this.sessionService.getSessionByPid(instanceId, pid);
  }

  @Post(':pid/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ resource: ResourceType.SESSION, action: ActionType.EXECUTE })
  async cancelQuery(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('pid', ParseIntPipe) pid: number,
  ) {
    const success = await this.sessionService.cancelQuery(instanceId, pid);
    return { success, message: success ? '쿼리가 취소되었습니다.' : '쿼리 취소에 실패했습니다.' };
  }

  @Post(':pid/terminate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ resource: ResourceType.SESSION, action: ActionType.EXECUTE })
  async terminateSession(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('pid', ParseIntPipe) pid: number,
  ) {
    const success = await this.sessionService.terminateSession(instanceId, pid);
    return { success, message: success ? '세션이 종료되었습니다.' : '세션 종료에 실패했습니다.' };
  }

  @Post('kill-idle')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ resource: ResourceType.SESSION, action: ActionType.EXECUTE })
  async killIdleSessions(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Query('olderThanMinutes') olderThanMinutes: string,
  ) {
    const minutes = parseInt(olderThanMinutes, 10) || 60;
    const killedCount = await this.sessionService.killIdleSessions(instanceId, minutes);
    return { killedCount, message: `${killedCount}개의 유휴 세션이 종료되었습니다.` };
  }
}
