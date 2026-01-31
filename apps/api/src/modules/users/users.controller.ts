import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
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

  @Post()
  @RequirePermission({ resource: ResourceType.USER, action: ActionType.CREATE })
  async create(@Body() data: any) {
    return this.usersService.create(data);
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
}
