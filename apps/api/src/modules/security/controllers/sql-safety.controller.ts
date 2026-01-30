import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SqlSafetyService } from '../services/sql-safety.service';
import { CreateSqlSafetyRuleDto, UpdateSqlSafetyRuleDto, ValidateSqlDto } from '../dto/security.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser, CurrentUserData } from '../../auth/decorators/current-user.decorator';
import { ResourceType, ActionType, ScopeType } from '@prisma/client';

@Controller('sql-safety-rules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SqlSafetyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sqlSafetyService: SqlSafetyService,
  ) {}

  @Get()
  @RequirePermission({ resource: ResourceType.CONFIG, action: ActionType.VIEW })
  async getRules(
    @Query('scopeType') scopeType?: ScopeType,
    @Query('enabled') enabled?: string,
  ) {
    const where: any = {};

    if (scopeType) {
      where.scopeType = scopeType;
    }

    if (enabled !== undefined) {
      where.enabled = enabled === 'true';
    }

    return this.prisma.sqlSafetyRule.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
  }

  @Get(':id')
  @RequirePermission({ resource: ResourceType.CONFIG, action: ActionType.VIEW })
  async getRuleById(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.sqlSafetyRule.findUnique({ where: { id } });
  }

  @Post()
  @RequirePermission({ resource: ResourceType.CONFIG, action: ActionType.CREATE })
  async createRule(@Body() dto: CreateSqlSafetyRuleDto) {
    return this.prisma.sqlSafetyRule.create({
      data: {
        name: dto.name,
        description: dto.description,
        scopeType: dto.scopeType || ScopeType.GLOBAL,
        scopeId: dto.scopeId,
        ruleType: dto.ruleType,
        pattern: dto.pattern,
        keywords: dto.keywords as any,
        maxRowsAffected: dto.maxRowsAffected,
        maxExecutionTime: dto.maxExecutionTime,
        forceExplain: dto.forceExplain || false,
        action: dto.action,
        enabled: dto.enabled ?? true,
        priority: dto.priority || 0,
      },
    });
  }

  @Put(':id')
  @RequirePermission({ resource: ResourceType.CONFIG, action: ActionType.UPDATE })
  async updateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSqlSafetyRuleDto,
  ) {
    return this.prisma.sqlSafetyRule.update({
      where: { id },
      data: {
        ...dto,
        keywords: dto.keywords as any,
      },
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ resource: ResourceType.CONFIG, action: ActionType.DELETE })
  async deleteRule(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.sqlSafetyRule.delete({ where: { id } });
  }

  @Post('validate')
  @RequirePermission({ resource: ResourceType.QUERY, action: ActionType.VIEW })
  async validateSql(
    @Body() dto: ValidateSqlDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.sqlSafetyService.validateQuery(dto.query, {
      userId: user.id,
      instanceId: dto.instanceId,
      databaseId: dto.databaseId,
      isReadOnly: dto.isReadOnly,
    });
  }
}
