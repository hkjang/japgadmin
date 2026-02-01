import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ExtensionsService } from './extensions.service';

@Controller('extensions')
export class ExtensionsController {
  constructor(private readonly extensionsService: ExtensionsService) {}

  @Get()
  async getExtensions(
    @Query('instanceId') instanceId: string,
    @Query('sortBy') sortBy?: 'name' | 'popularity' | 'recent',
  ) {
    if (!instanceId) {
      throw new Error('instanceId is required');
    }
    return this.extensionsService.getExtensions(instanceId, sortBy);
  }

  @Post()
  async installExtension(
    @Body() body: { name: string; schema?: string; version?: string; instanceId: string },
  ) {
    return await this.extensionsService.installExtension(
      body.instanceId,
      body.name,
      body.schema,
      body.version,
    );
  }

  @Delete(':name')
  async removeExtension(
    @Param('name') name: string,
    @Query('instanceId') instanceId: string,
  ) {
    return await this.extensionsService.removeExtension(instanceId, name);
  }

  @Post('install-sql')
  async installExtensionFromSql(
    @Body() body: { instanceId: string; sqlContent: string },
  ) {
    return await this.extensionsService.installExtensionFromSql(
      body.instanceId,
      body.sqlContent,
    );
  }
}
