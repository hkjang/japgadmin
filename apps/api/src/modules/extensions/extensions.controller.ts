import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ExtensionsService } from './extensions.service';

@Controller('extensions')
export class ExtensionsController {
  constructor(private readonly extensionsService: ExtensionsService) {}

  @Get()
  async getExtensions() {
    return await this.extensionsService.getExtensions();
  }

  @Post()
  async installExtension(
    @Body() body: { name: string; schema?: string; version?: string },
  ) {
    return await this.extensionsService.installExtension(
      body.name,
      body.schema,
      body.version,
    );
  }

  @Delete(':name')
  async removeExtension(@Param('name') name: string) {
    return await this.extensionsService.removeExtension(name);
  }
}
