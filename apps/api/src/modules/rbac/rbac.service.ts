import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Role, Permission, UserRole, User, ScopeType, Prisma } from '@prisma/client';
import {
  CreateRoleDto,
  UpdateRoleDto,
  CreatePermissionDto,
  AssignRoleDto,
  BulkAssignRolesDto,
} from './dto/rbac.dto';
import { SYSTEM_ROLES, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } from './predefined-roles';
import * as bcrypt from 'bcrypt';

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
  _count?: { users: number };
}

export interface UserWithRoles extends User {
  roles: (UserRole & { role: RoleWithPermissions })[];
}

@Injectable()
export class RbacService implements OnModuleInit {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedSystemRoles();
    await this.seedDefaultAdmin();
  }

  // ==================== SEEDING ====================

  private async seedSystemRoles(): Promise<void> {
    for (const roleData of SYSTEM_ROLES) {
      const existing = await this.prisma.role.findUnique({
        where: { name: roleData.name },
      });

      if (!existing) {
        this.logger.log(`Creating system role: ${roleData.name}`);

        const role = await this.prisma.role.create({
          data: {
            name: roleData.name,
            description: roleData.description,
            scopeType: roleData.scopeType,
            isSystem: roleData.isSystem,
          },
        });

        // Create permissions for the role
        for (const perm of roleData.permissions) {
          await this.prisma.permission.create({
            data: {
              roleId: role.id,
              resource: perm.resource,
              action: perm.action,
              conditions: perm.conditions as any,
            },
          });
        }
      }
    }
  }

  private async seedDefaultAdmin(): Promise<void> {
    const existingAdmin = await this.prisma.user.findUnique({
      where: { email: DEFAULT_ADMIN_EMAIL },
    });

    if (!existingAdmin) {
      this.logger.log('Creating default admin user');

      const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);

      const admin = await this.prisma.user.create({
        data: {
          email: DEFAULT_ADMIN_EMAIL,
          passwordHash,
          firstName: 'Admin',
          lastName: 'User',
          status: 'ACTIVE',
        },
      });

      // Assign Super Admin role
      const superAdminRole = await this.prisma.role.findUnique({
        where: { name: 'Super Admin' },
      });

      if (superAdminRole) {
        await this.prisma.userRole.create({
          data: {
            userId: admin.id,
            roleId: superAdminRole.id,
          },
        });
      }

      this.logger.log(`Default admin created: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
    }
  }

  // ==================== ROLES ====================

  async createRole(dto: CreateRoleDto): Promise<Role> {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`역할 이름이 이미 존재합니다: ${dto.name}`);
    }

    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        scopeType: dto.scopeType || ScopeType.GLOBAL,
        scopeId: dto.scopeId,
        isSystem: false,
      },
    });
  }

  async getRoles(params?: {
    scopeType?: ScopeType;
    search?: string;
    includeSystem?: boolean;
  }): Promise<RoleWithPermissions[]> {
    const where: Prisma.RoleWhereInput = {};

    if (params?.scopeType) {
      where.scopeType = params.scopeType;
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (!params?.includeSystem) {
      // By default, include system roles
    }

    const roles = await this.prisma.role.findMany({
      where,
      include: {
        permissions: true,
        _count: { select: { users: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return roles as RoleWithPermissions[];
  }

  async getRoleById(id: string): Promise<RoleWithPermissions> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: true,
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                status: true,
              },
            },
          },
        },
        _count: { select: { users: true } },
      },
    });

    if (!role) {
      throw new NotFoundException(`역할을 찾을 수 없습니다: ${id}`);
    }

    return role as RoleWithPermissions;
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<Role> {
    const existing = await this.prisma.role.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`역할을 찾을 수 없습니다: ${id}`);
    }

    if (existing.isSystem) {
      throw new BadRequestException('시스템 역할은 수정할 수 없습니다.');
    }

    if (dto.name && dto.name !== existing.name) {
      const nameExists = await this.prisma.role.findUnique({
        where: { name: dto.name },
      });
      if (nameExists) {
        throw new ConflictException(`역할 이름이 이미 존재합니다: ${dto.name}`);
      }
    }

    return this.prisma.role.update({
      where: { id },
      data: dto,
    });
  }

  async deleteRole(id: string): Promise<void> {
    const existing = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!existing) {
      throw new NotFoundException(`역할을 찾을 수 없습니다: ${id}`);
    }

    if (existing.isSystem) {
      throw new BadRequestException('시스템 역할은 삭제할 수 없습니다.');
    }

    if (existing._count.users > 0) {
      throw new BadRequestException(
        `이 역할은 ${existing._count.users}명의 사용자에게 할당되어 있습니다. 먼저 역할 할당을 해제해주세요.`,
      );
    }

    await this.prisma.role.delete({ where: { id } });
  }

  // ==================== PERMISSIONS ====================

  async addPermission(dto: CreatePermissionDto): Promise<Permission> {
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });

    if (!role) {
      throw new NotFoundException(`역할을 찾을 수 없습니다: ${dto.roleId}`);
    }

    if (role.isSystem) {
      throw new BadRequestException('시스템 역할의 권한은 수정할 수 없습니다.');
    }

    const existing = await this.prisma.permission.findFirst({
      where: {
        roleId: dto.roleId,
        resource: dto.resource,
        action: dto.action,
      },
    });

    if (existing) {
      throw new ConflictException('이미 동일한 권한이 존재합니다.');
    }

    return this.prisma.permission.create({
      data: {
        roleId: dto.roleId,
        resource: dto.resource,
        action: dto.action,
        conditions: dto.conditions as any,
      },
    });
  }

  async removePermission(permissionId: string): Promise<void> {
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
      include: { role: true },
    });

    if (!permission) {
      throw new NotFoundException(`권한을 찾을 수 없습니다: ${permissionId}`);
    }

    if (permission.role.isSystem) {
      throw new BadRequestException('시스템 역할의 권한은 삭제할 수 없습니다.');
    }

    await this.prisma.permission.delete({ where: { id: permissionId } });
  }

  // ==================== USER ROLE ASSIGNMENT ====================

  async assignRole(dto: AssignRoleDto, grantedById?: string): Promise<UserRole> {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.userId } }),
      this.prisma.role.findUnique({ where: { id: dto.roleId } }),
    ]);

    if (!user) {
      throw new NotFoundException(`사용자를 찾을 수 없습니다: ${dto.userId}`);
    }

    if (!role) {
      throw new NotFoundException(`역할을 찾을 수 없습니다: ${dto.roleId}`);
    }

    const existing = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: dto.userId,
          roleId: dto.roleId,
        },
      },
    });

    if (existing) {
      // Update expiration if provided
      if (dto.expiresAt) {
        return this.prisma.userRole.update({
          where: { id: existing.id },
          data: { expiresAt: new Date(dto.expiresAt) },
        });
      }
      throw new ConflictException('이미 해당 역할이 할당되어 있습니다.');
    }

    return this.prisma.userRole.create({
      data: {
        userId: dto.userId,
        roleId: dto.roleId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        grantedById,
      },
    });
  }

  async revokeRole(userId: string, roleId: string): Promise<void> {
    const existing = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('해당 역할 할당을 찾을 수 없습니다.');
    }

    await this.prisma.userRole.delete({ where: { id: existing.id } });
  }

  async bulkAssignRoles(dto: BulkAssignRolesDto, grantedById?: string): Promise<number> {
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });

    if (!role) {
      throw new NotFoundException(`역할을 찾을 수 없습니다: ${dto.roleId}`);
    }

    let assignedCount = 0;

    for (const userId of dto.userIds) {
      try {
        await this.assignRole(
          { userId, roleId: dto.roleId, expiresAt: dto.expiresAt },
          grantedById,
        );
        assignedCount++;
      } catch (error) {
        // Skip if already assigned
        this.logger.warn(`Failed to assign role to user ${userId}: ${error.message}`);
      }
    }

    return assignedCount;
  }

  // ==================== USER QUERIES ====================

  async getUserRoles(userId: string): Promise<RoleWithPermissions[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        role: {
          include: { permissions: true },
        },
      },
    });

    return userRoles.map((ur) => ur.role as RoleWithPermissions);
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const roles = await this.getUserRoles(userId);
    const permissions: Permission[] = [];

    for (const role of roles) {
      permissions.push(...role.permissions);
    }

    // Remove duplicates
    const uniquePermissions = permissions.filter(
      (p, index, self) =>
        index ===
        self.findIndex((t) => t.resource === p.resource && t.action === p.action),
    );

    return uniquePermissions;
  }

  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    scopeId?: string,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);

    return permissions.some((p) => {
      const resourceMatch = p.resource === resource || p.action === 'ADMIN';
      const actionMatch = p.action === action || p.action === 'ADMIN';

      // TODO: Check scope if provided
      return resourceMatch && actionMatch;
    });
  }

  // ==================== USERS MANAGEMENT ====================

  async getUsers(params?: {
    roleId?: string;
    search?: string;
    skip?: number;
    take?: number;
  }): Promise<{ users: UserWithRoles[]; total: number }> {
    const where: Prisma.UserWhereInput = {};

    if (params?.roleId) {
      where.roles = {
        some: { roleId: params.roleId },
      };
    }

    if (params?.search) {
      where.OR = [
        { email: { contains: params.search, mode: 'insensitive' } },
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          roles: {
            include: {
              role: {
                include: { permissions: true },
              },
            },
            where: {
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          },
        },
        orderBy: { email: 'asc' },
        skip: params?.skip,
        take: params?.take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users: users as UserWithRoles[], total };
  }

  async cleanupExpiredRoles(): Promise<number> {
    const result = await this.prisma.userRole.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }
}
