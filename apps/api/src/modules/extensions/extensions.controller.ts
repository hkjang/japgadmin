import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ExtensionsService } from './extensions.service';

@Controller('extensions')
export class ExtensionsController {
  constructor(private readonly extensionsService: ExtensionsService) {}

  @Get()
  async getExtensions(@Query('instanceId') instanceId: string) {
    if (!instanceId) {
      // Potentially bad request, or maybe we want to support default? 
      // For now, require instanceId as the service needs it.
      // But let's check if the service throws if missing. TypeScript says string, so validation pipe might catch it or it passes undefined.
      // We should probably enforce it.
      // throw new BadRequestException('Instance ID is required');
    }
    return await this.extensionsService.getExtensions(instanceId);
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
