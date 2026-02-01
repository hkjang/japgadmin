import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ResourceType, ActionType } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission({ resource: ResourceType.USER, action: ActionType.VIEW })
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @RequirePermission({ resource: ResourceType.USER, action: ActionType.VIEW })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermission({ resource: ResourceType.USER, action: ActionType.CREATE })
  async create(@Body() data: any) {
    return this.usersService.create(data);
  }

  @Put(':id')
  @RequirePermission({ resource: ResourceType.USER, action: ActionType.UPDATE })
  async update(@Param('id') id: string, @Body() data: any) {
    return this.usersService.update(id, data);
  }

  @Delete(':id')
  @RequirePermission({ resource: ResourceType.USER, action: ActionType.DELETE })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission({ resource: ResourceType.ROLE, action: ActionType.VIEW })
  async findAll() {
    return this.usersService.findAllRoles();
  }

  @Post()
  @RequirePermission({ resource: ResourceType.ROLE, action: ActionType.CREATE })
  async create(@Body() data: any) {
    return this.usersService.createRole(data);
  }

  @Put(':id')
  @RequirePermission({ resource: ResourceType.ROLE, action: ActionType.UPDATE })
  async update(@Param('id') id: string, @Body() data: any) {
    return this.usersService.updateRole(id, data);
  }

  @Delete(':id')
  @RequirePermission({ resource: ResourceType.ROLE, action: ActionType.DELETE })
  async remove(@Param('id') id: string) {
    return this.usersService.deleteRole(id);
  }
}
