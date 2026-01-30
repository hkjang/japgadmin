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
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateClusterDto, UpdateClusterDto } from './dto/create-cluster.dto';
import { CreateInstanceDto, UpdateInstanceDto, TestConnectionDto } from './dto/create-instance.dto';
import { CreateDatabaseDto, UpdateDatabaseDto } from './dto/create-database.dto';
import { Environment, InstanceStatus } from '@prisma/client';

@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ==================== SUMMARY ====================

  @Get('inventory/summary')
  async getInventorySummary() {
    return this.inventoryService.getInventorySummary();
  }

  // ==================== CLUSTERS ====================

  @Get('clusters')
  async getClusters(
    @Query('environment') environment?: Environment,
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.inventoryService.getClusters({
      environment,
      search,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get('clusters/:id')
  async getClusterById(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getClusterById(id);
  }

  @Post('clusters')
  async createCluster(@Body() dto: CreateClusterDto) {
    return this.inventoryService.createCluster(dto);
  }

  @Put('clusters/:id')
  async updateCluster(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClusterDto,
  ) {
    return this.inventoryService.updateCluster(id, dto);
  }

  @Delete('clusters/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCluster(@Param('id', ParseUUIDPipe) id: string) {
    await this.inventoryService.deleteCluster(id);
  }

  // ==================== INSTANCES ====================

  @Get('instances')
  async getInstances(
    @Query('clusterId') clusterId?: string,
    @Query('status') status?: InstanceStatus,
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.inventoryService.getInstances({
      clusterId,
      status,
      search,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get('instances/:id')
  async getInstanceById(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getInstanceById(id);
  }

  @Post('instances')
  async createInstance(@Body() dto: CreateInstanceDto) {
    return this.inventoryService.createInstance(dto);
  }

  @Put('instances/:id')
  async updateInstance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstanceDto,
  ) {
    return this.inventoryService.updateInstance(id, dto);
  }

  @Delete('instances/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteInstance(@Param('id', ParseUUIDPipe) id: string) {
    await this.inventoryService.deleteInstance(id);
  }

  @Post('instances/:id/test-connection')
  async testInstanceConnection(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.testInstanceConnection(id);
  }

  @Post('instances/:id/discover-databases')
  async discoverDatabases(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.discoverDatabases(id);
  }

  @Post('instances/:id/discover-extensions')
  async discoverExtensions(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.discoverExtensions(id);
  }

  @Post('instances/test-connection')
  async testConnection(@Body() dto: TestConnectionDto) {
    return this.inventoryService.testConnection(dto);
  }

  // ==================== DATABASES ====================

  @Get('databases')
  async getDatabases(
    @Query('instanceId') instanceId?: string,
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.inventoryService.getDatabases({
      instanceId,
      search,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get('databases/:id')
  async getDatabaseById(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getDatabaseById(id);
  }

  @Post('databases')
  async createDatabase(@Body() dto: CreateDatabaseDto) {
    return this.inventoryService.createDatabase(dto);
  }

  @Put('databases/:id')
  async updateDatabase(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDatabaseDto,
  ) {
    return this.inventoryService.updateDatabase(id, dto);
  }

  @Delete('databases/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDatabase(@Param('id', ParseUUIDPipe) id: string) {
    await this.inventoryService.deleteDatabase(id);
  }
}
