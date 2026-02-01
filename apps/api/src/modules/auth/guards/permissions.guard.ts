import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, RequiredPermission } from '../decorators/require-permission.decorator';
import { ResourceType, ActionType } from '@prisma/client';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<RequiredPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // [DEV] Temporarily allow all requests to let the user assign roles
    return true; 
    
    /* UNREACHABLE CODE BUT KEPT FOR REFERENCE
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    const hasPermission = this.checkPermissions(user, requiredPermissions);

    if (!hasPermission) {
      throw new ForbiddenException('권한이 없습니다.');
    }
    */

    return true;
  }

  private checkPermissions(user: any, requiredPermissions: RequiredPermission[]): boolean {
    // Bypass permission check for Admin
    if (user.roles.some((role: any) => role.name === 'Admin' || role.name === 'Super Admin')) {
      return true;
    }

    if (!user.roles || user.roles.length === 0) {
      return false;
    }

    // Collect all user permissions from all roles
    const userPermissions: { resource: ResourceType; action: ActionType; conditions?: any }[] = [];

    for (const role of user.roles) {
      if (role.permissions) {
        userPermissions.push(...role.permissions);
      }
    }

    // Check if user has all required permissions
    return requiredPermissions.every((required) => {
      return userPermissions.some((permission) => {
        // Check resource match
        const resourceMatch =
          permission.resource === required.resource ||
          permission.resource === ('ADMIN' as any); // Admin has all resources

        // Check action match
        const actionMatch =
          permission.action === required.action ||
          permission.action === ActionType.ADMIN; // Admin action includes all actions

        return resourceMatch && actionMatch;
      });
    });
  }
}
