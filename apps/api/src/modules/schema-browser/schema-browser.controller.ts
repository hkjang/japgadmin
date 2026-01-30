import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { SchemaBrowserService } from './schema-browser.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ResourceType, ActionType } from '@prisma/client';

@Controller('instances/:instanceId/schema')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SchemaBrowserController {
  constructor(private readonly schemaBrowserService: SchemaBrowserService) {}

  @Get('schemas')
  @RequirePermission({ resource: ResourceType.DATABASE, action: ActionType.VIEW })
  async getSchemas(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Query('database') database: string = 'postgres',
  ) {
    return this.schemaBrowserService.getSchemas(instanceId, database);
  }

  @Get('tables')
  @RequirePermission({ resource: ResourceType.DATABASE, action: ActionType.VIEW })
  async getTables(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Query('schema') schema: string = 'public',
    @Query('includeViews') includeViews?: string,
    @Query('search') search?: string,
  ) {
    return this.schemaBrowserService.getTables(instanceId, schema, {
      includeViews: includeViews === 'true',
      search,
    });
  }

  @Get('tables/:schema/:table/columns')
  @RequirePermission({ resource: ResourceType.DATABASE, action: ActionType.VIEW })
  async getColumns(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('schema') schema: string,
    @Param('table') table: string,
  ) {
    return this.schemaBrowserService.getColumns(instanceId, schema, table);
  }

  @Get('tables/:schema/:table/indexes')
  @RequirePermission({ resource: ResourceType.DATABASE, action: ActionType.VIEW })
  async getIndexes(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('schema') schema: string,
    @Param('table') table: string,
  ) {
    return this.schemaBrowserService.getIndexes(instanceId, schema, table);
  }

  @Get('tables/:schema/:table/foreign-keys')
  @RequirePermission({ resource: ResourceType.DATABASE, action: ActionType.VIEW })
  async getForeignKeys(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('schema') schema: string,
    @Param('table') table: string,
  ) {
    return this.schemaBrowserService.getForeignKeys(instanceId, schema, table);
  }

  @Get('tables/:schema/:table/ddl')
  @RequirePermission({ resource: ResourceType.DATABASE, action: ActionType.VIEW })
  async getTableDdl(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('schema') schema: string,
    @Param('table') table: string,
  ) {
    const ddl = await this.schemaBrowserService.getTableDdl(instanceId, schema, table);
    return { ddl };
  }

  @Get('functions')
  @RequirePermission({ resource: ResourceType.DATABASE, action: ActionType.VIEW })
  async getFunctions(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Query('schema') schema: string = 'public',
  ) {
    return this.schemaBrowserService.getFunctions(instanceId, schema);
  }

  @Get('functions/:schema/:function/ddl')
  @RequirePermission({ resource: ResourceType.DATABASE, action: ActionType.VIEW })
  async getFunctionDdl(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('schema') schema: string,
    @Param('function') functionName: string,
    @Query('args') args?: string,
  ) {
    const ddl = await this.schemaBrowserService.getFunctionDdl(instanceId, schema, functionName, args);
    return { ddl };
  }

  @Get('indexes/:schema/:index/ddl')
  @RequirePermission({ resource: ResourceType.DATABASE, action: ActionType.VIEW })
  async getIndexDdl(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('schema') schema: string,
    @Param('index') indexName: string,
  ) {
    const ddl = await this.schemaBrowserService.getIndexDdl(instanceId, schema, indexName);
    return { ddl };
  }

  @Get('search')
  @RequirePermission({ resource: ResourceType.DATABASE, action: ActionType.VIEW })
  async searchObjects(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Query('q') search: string,
    @Query('limit') limit?: string,
  ) {
    return this.schemaBrowserService.searchObjects(
      instanceId,
      search,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
