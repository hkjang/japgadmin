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
import { RbacService } from './rbac.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  CreatePermissionDto,
  AssignRoleDto,
  BulkAssignRolesDto,
} from './dto/rbac.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { ResourceType, ActionType, ScopeType } from '@prisma/client';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  // ==================== ROLES ====================

  @Get('roles')
  @RequirePermission({ resource: ResourceType.ROLE, action: ActionType.VIEW })
  async getRoles(
    @Query('scopeType') scopeType?: ScopeType,
    @Query('search') search?: string,
    @Query('includeSystem') includeSystem?: string,
  ) {
    return this.rbacService.getRoles({
      scopeType,
      search,
      includeSystem: includeSystem === 'true',
    });
  }

  @Get('roles/:id')
  @RequirePermission({ resource: ResourceType.ROLE, action: ActionType.VIEW })
  async getRoleById(@Param('id', ParseUUIDPipe) id: string) {
    return this.rbacService.getRoleById(id);
  }

  @Post('roles')
  @RequirePermission({ resource: ResourceType.ROLE, action: ActionType.CREATE })
  async createRole(@Body() dto: CreateRoleDto) {
    return this.rbacService.createRole(dto);
  }

  @Put('roles/:id')
  @RequirePermission({ resource: ResourceType.ROLE, action: ActionType.UPDATE })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rbacService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ resource: ResourceType.ROLE, action: ActionType.DELETE })
  async deleteRole(@Param('id', ParseUUIDPipe) id: string) {
    await this.rbacService.deleteRole(id);
  }

  // ==================== PERMISSIONS ====================

  @Post('permissions')
  @RequirePermission({ resource: ResourceType.ROLE, action: ActionType.UPDATE })
  async addPermission(@Body() dto: CreatePermissionDto) {
    return this.rbacService.addPermission(dto);
  }

  @Delete('permissions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ resource: ResourceType.ROLE, action: ActionType.UPDATE })
  async removePermission(@Param('id', ParseUUIDPipe) id: string) {
    await this.rbacService.removePermission(id);
  }

  // ==================== USER ROLE ASSIGNMENT ====================

  @Post('user-roles')
  @RequirePermission({ resource: ResourceType.USER, action: ActionType.UPDATE })
  async assignRole(
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.rbacService.assignRole(dto, user.id);
  }

  @Delete('user-roles/:userId/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ resource: ResourceType.USER, action: ActionType.UPDATE })
  async revokeRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    await this.rbacService.revokeRole(userId, roleId);
  }

  @Post('user-roles/bulk')
  @RequirePermission({ resource: ResourceType.USER, action: ActionType.UPDATE })
  async bulkAssignRoles(
    @Body() dto: BulkAssignRolesDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const count = await this.rbacService.bulkAssignRoles(dto, user.id);
    return { assignedCount: count };
  }

  // ==================== USER QUERIES ====================

  @Get('users/:id/roles')
  @RequirePermission({ resource: ResourceType.USER, action: ActionType.VIEW })
  async getUserRoles(@Param('id', ParseUUIDPipe) id: string) {
    return this.rbacService.getUserRoles(id);
  }

  @Get('users/:id/permissions')
  @RequirePermission({ resource: ResourceType.USER, action: ActionType.VIEW })
  async getUserPermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.rbacService.getUserPermissions(id);
  }

  // ==================== USERS MANAGEMENT ====================

  @Get('users')
  @RequirePermission({ resource: ResourceType.USER, action: ActionType.VIEW })
  async getUsers(
    @Query('roleId') roleId?: string,
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.rbacService.getUsers({
      roleId,
      search,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }
}
