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

    // Role 업데이트
    if (data.roles) {
      // 기존 역할 제거
      await this.prisma.userRole.deleteMany({
        where: { userId: id },
      });

      // 새 역할 할당 (Scope 등 추가 로직 필요시 확장)
      // 간단히 구현: data.roles는 roleId 배열 또는 {roleId, scope} 배열
      // 여기서는 roleId 배열로 가정하거나 Api 구조에 맞춤
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
      },
    });
  }

  async updateRole(id: string, data: any) {
    // System role check could be here if we want to restrict renaming system roles
    // For now, allow description updates etc.
    return this.prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
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
