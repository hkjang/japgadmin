import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { QueryConsoleService, ExecuteQueryDto } from './query-console.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ResourceType, ActionType } from '@prisma/client';

@Controller('query-console')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QueryConsoleController {
  constructor(private readonly queryConsoleService: QueryConsoleService) {}

  // ============ Query Execution ============

  @Post('execute')
  @RequirePermission({ resource: ResourceType.QUERY, action: ActionType.EXECUTE })
  async executeQuery(@Body() dto: ExecuteQueryDto, @CurrentUser() user: any) {
    return this.queryConsoleService.executeQuery(dto, user?.id);
  }

  @Post('explain')
  @RequirePermission({ resource: ResourceType.QUERY, action: ActionType.EXECUTE })
  async explainQuery(
    @Body('instanceId', ParseUUIDPipe) instanceId: string,
    @Body('query') query: string,
    @Body('analyze') analyze?: boolean,
    @Body('buffers') buffers?: boolean,
    @Body('format') format?: 'text' | 'json',
  ) {
    return this.queryConsoleService.explainQuery(instanceId, query, {
      analyze,
      buffers,
      format,
    });
  }

  @Post('format')
  @RequirePermission({ resource: ResourceType.QUERY, action: ActionType.VIEW })
  formatQuery(@Body('query') query: string) {
    return {
      formatted: this.queryConsoleService.formatQuery(query),
    };
  }

  // ============ Query History ============

  @Get('history')
  @RequirePermission({ resource: ResourceType.QUERY, action: ActionType.VIEW })
  async getQueryHistory(
    @Query('instanceId') instanceId?: string,
    @Query('userId') userId?: string,
    @Query('success') success?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.queryConsoleService.getQueryHistory({
      instanceId,
      userId,
      success: success !== undefined ? success === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  // ============ Saved Queries ============

  @Post('saved')
  @RequirePermission({ resource: ResourceType.QUERY, action: ActionType.CREATE })
  async saveQuery(
    @Body()
    data: {
      name: string;
      description?: string;
      query: string;
      instanceId?: string;
      isPublic?: boolean;
    },
    @CurrentUser() user: any,
  ) {
    return this.queryConsoleService.saveQuery(user.id, data);
  }

  @Get('saved')
  @RequirePermission({ resource: ResourceType.QUERY, action: ActionType.VIEW })
  async getSavedQueries(
    @CurrentUser() user: any,
    @Query('instanceId') instanceId?: string,
  ) {
    return this.queryConsoleService.getSavedQueries(user.id, instanceId);
  }

  @Delete('saved/:id')
  @RequirePermission({ resource: ResourceType.QUERY, action: ActionType.DELETE })
  async deleteSavedQuery(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    await this.queryConsoleService.deleteSavedQuery(id, user.id);
    return { success: true };
  }

  // ============ Autocomplete ============

  @Get('autocomplete')
  @RequirePermission({ resource: ResourceType.QUERY, action: ActionType.VIEW })
  async getAutocompleteSuggestions(
    @Query('instanceId', ParseUUIDPipe) instanceId: string,
    @Query('prefix') prefix: string,
    @Query('context') context: 'table' | 'column' | 'schema' | 'function' | 'keyword',
  ) {
    const suggestions = await this.queryConsoleService.getAutocompleteSuggestions(
      instanceId,
      prefix || '',
      context || 'keyword',
    );
    return { suggestions };
  }
}
