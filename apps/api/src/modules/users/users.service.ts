import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async create(data: any) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    return this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash: hashedPassword,
        status: UserStatus.ACTIVE,
        roles: {
          create: data.roles?.map((roleId: string) => ({
            role: { connect: { id: roleId } },
          })),
        },
      },
    });
  }

  async update(id: string, data: any) {
    const updateData: any = {
      username: data.username,
      email: data.email,
      status: data.status,
    };

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    // Handle Roles update using transaction-like nested write
    if (data.roles) {
      updateData.roles = {
        deleteMany: {}, // Clear existing roles
        create: data.roles.map((roleId: string) => ({
          role: { connect: { id: roleId } },
        })),
      };
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async findAllRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async createRole(data: any) {
    const existingRole = await this.prisma.role.findUnique({
      where: { name: data.name },
    });

    if (existingRole) {
      throw new ConflictException('Role already exists');
    }

    return this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        isSystem: false,
        permissions: {
          create: data.permissions?.map((p: any) => ({
            resource: p.resource,
            action: p.action,
          })),
        },
      },
    });
  }

  async updateRole(id: string, data: any) {
    // Permission 업데이트 로직
    if (data.permissions) {
      // 기존 권한 제거
      await this.prisma.permission.deleteMany({
        where: { roleId: id },
      });
      
      // 새 권한 추가 (Transaction 권장되나 여기선 간단히 처리)
      // Prisma update nested create는 연결/생성을 처리함. 
      // deleteMany 후 update data 안에서 create를 사용하면 됨.
      // 하지만 role update의 data에 permissions create를 넣으려면
      // 이미 deleteMany를 했으므로 create를 쓰면 됨.
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        permissions: data.permissions ? {
          create: data.permissions.map((p: any) => ({
            resource: p.resource,
            action: p.action,
          })),
        } : undefined,
      },
    });
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (role?.isSystem) {
      throw new ConflictException('Cannot delete system role');
    }

    return this.prisma.role.delete({
      where: { id },
    });
  }
}
