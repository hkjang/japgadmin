import { SetMetadata } from '@nestjs/common';
import { ResourceType, ActionType } from '@prisma/client';

export interface RequiredPermission {
  resource: ResourceType;
  action: ActionType;
}

export const PERMISSIONS_KEY = 'permissions';

export const RequirePermission = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// Shorthand decorators for common permissions
export const CanView = (resource: ResourceType) =>
  RequirePermission({ resource, action: ActionType.VIEW });

export const CanCreate = (resource: ResourceType) =>
  RequirePermission({ resource, action: ActionType.CREATE });

export const CanUpdate = (resource: ResourceType) =>
  RequirePermission({ resource, action: ActionType.UPDATE });

export const CanDelete = (resource: ResourceType) =>
  RequirePermission({ resource, action: ActionType.DELETE });

export const CanExecute = (resource: ResourceType) =>
  RequirePermission({ resource, action: ActionType.EXECUTE });

export const CanAdmin = (resource: ResourceType) =>
  RequirePermission({ resource, action: ActionType.ADMIN });
