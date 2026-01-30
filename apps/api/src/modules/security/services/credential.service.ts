import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EncryptionService } from './encryption.service';
import { Credential, CredentialType, Prisma } from '@prisma/client';

export interface CredentialData {
  username?: string;
  password?: string;
  privateKey?: string;
  certificate?: string;
  apiKey?: string;
  [key: string]: any;
}

export interface CreateCredentialDto {
  name: string;
  type: CredentialType;
  data: CredentialData;
  rotationEnabled?: boolean;
  rotationDays?: number;
}

export interface UpdateCredentialDto {
  name?: string;
  data?: CredentialData;
  rotationEnabled?: boolean;
  rotationDays?: number;
}

@Injectable()
export class CredentialService {
  private readonly logger = new Logger(CredentialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Create a new credential
   */
  async createCredential(dto: CreateCredentialDto, userId?: string): Promise<Credential> {
    const existing = await this.prisma.credential.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`자격 증명 이름이 이미 존재합니다: ${dto.name}`);
    }

    // Encrypt the credential data
    const encryptedData = this.encryptionService.encryptObject(dto.data);

    const credential = await this.prisma.credential.create({
      data: {
        name: dto.name,
        type: dto.type,
        encryptedData,
        rotationEnabled: dto.rotationEnabled || false,
        rotationDays: dto.rotationDays,
        createdById: userId,
      },
    });

    // Log access
    if (userId) {
      await this.logAccess(credential.id, userId, 'create');
    }

    return this.sanitizeCredential(credential);
  }

  /**
   * Get all credentials (without decrypted data)
   */
  async getCredentials(params?: {
    type?: CredentialType;
    search?: string;
  }): Promise<Credential[]> {
    const where: Prisma.CredentialWhereInput = {};

    if (params?.type) {
      where.type = params.type;
    }

    if (params?.search) {
      where.name = { contains: params.search, mode: 'insensitive' };
    }

    const credentials = await this.prisma.credential.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return credentials.map((c) => this.sanitizeCredential(c));
  }

  /**
   * Get a credential by ID (without decrypted data)
   */
  async getCredentialById(id: string): Promise<Credential> {
    const credential = await this.prisma.credential.findUnique({
      where: { id },
    });

    if (!credential) {
      throw new NotFoundException(`자격 증명을 찾을 수 없습니다: ${id}`);
    }

    return this.sanitizeCredential(credential);
  }

  /**
   * Get decrypted credential data (for internal use only)
   */
  async getDecryptedCredential(id: string, userId?: string): Promise<CredentialData> {
    const credential = await this.prisma.credential.findUnique({
      where: { id },
    });

    if (!credential) {
      throw new NotFoundException(`자격 증명을 찾을 수 없습니다: ${id}`);
    }

    if (!credential.encryptedData) {
      throw new Error('자격 증명 데이터가 없습니다.');
    }

    // Log access
    if (userId) {
      await this.logAccess(id, userId, 'retrieve');
    }

    return this.encryptionService.decryptObject<CredentialData>(credential.encryptedData);
  }

  /**
   * Update a credential
   */
  async updateCredential(
    id: string,
    dto: UpdateCredentialDto,
    userId?: string,
  ): Promise<Credential> {
    const existing = await this.prisma.credential.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`자격 증명을 찾을 수 없습니다: ${id}`);
    }

    if (dto.name && dto.name !== existing.name) {
      const nameExists = await this.prisma.credential.findUnique({
        where: { name: dto.name },
      });
      if (nameExists) {
        throw new ConflictException(`자격 증명 이름이 이미 존재합니다: ${dto.name}`);
      }
    }

    const updateData: Prisma.CredentialUpdateInput = {
      name: dto.name,
      rotationEnabled: dto.rotationEnabled,
      rotationDays: dto.rotationDays,
    };

    // If new data provided, encrypt it
    if (dto.data) {
      updateData.encryptedData = this.encryptionService.encryptObject(dto.data);
    }

    const updated = await this.prisma.credential.update({
      where: { id },
      data: updateData,
    });

    // Log access
    if (userId) {
      await this.logAccess(id, userId, 'update');
    }

    return this.sanitizeCredential(updated);
  }

  /**
   * Delete a credential
   */
  async deleteCredential(id: string, userId?: string): Promise<void> {
    const existing = await this.prisma.credential.findUnique({
      where: { id },
      include: { instances: true },
    });

    if (!existing) {
      throw new NotFoundException(`자격 증명을 찾을 수 없습니다: ${id}`);
    }

    if (existing.instances.length > 0) {
      throw new ConflictException(
        `이 자격 증명은 ${existing.instances.length}개의 인스턴스에서 사용 중입니다.`,
      );
    }

    // Log access before deletion
    if (userId) {
      await this.logAccess(id, userId, 'delete');
    }

    await this.prisma.credential.delete({ where: { id } });
  }

  /**
   * Rotate a credential (generate new password/key)
   */
  async rotateCredential(id: string, newData: CredentialData, userId?: string): Promise<Credential> {
    const existing = await this.prisma.credential.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`자격 증명을 찾을 수 없습니다: ${id}`);
    }

    const encryptedData = this.encryptionService.encryptObject(newData);

    const updated = await this.prisma.credential.update({
      where: { id },
      data: {
        encryptedData,
        lastRotatedAt: new Date(),
      },
    });

    // Log rotation
    if (userId) {
      await this.logAccess(id, userId, 'rotate');
    }

    this.logger.log(`Credential rotated: ${existing.name}`);

    return this.sanitizeCredential(updated);
  }

  /**
   * Get credentials that need rotation
   */
  async getCredentialsNeedingRotation(): Promise<Credential[]> {
    const credentials = await this.prisma.credential.findMany({
      where: {
        rotationEnabled: true,
        rotationDays: { not: null },
      },
    });

    const now = new Date();

    return credentials.filter((c) => {
      if (!c.rotationDays) return false;

      const lastRotation = c.lastRotatedAt || c.createdAt;
      const daysSinceRotation = Math.floor(
        (now.getTime() - lastRotation.getTime()) / (1000 * 60 * 60 * 24),
      );

      return daysSinceRotation >= c.rotationDays;
    });
  }

  /**
   * Log credential access
   */
  private async logAccess(credentialId: string, userId: string, action: string): Promise<void> {
    await this.prisma.credentialAccessLog.create({
      data: {
        credentialId,
        userId,
        action,
      },
    });
  }

  /**
   * Get credential access logs
   */
  async getAccessLogs(
    credentialId: string,
    params?: { skip?: number; take?: number },
  ): Promise<any[]> {
    const logs = await this.prisma.credentialAccessLog.findMany({
      where: { credentialId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      skip: params?.skip,
      take: params?.take,
    });

    return logs;
  }

  /**
   * Remove sensitive data from credential object
   */
  private sanitizeCredential(credential: Credential): Credential {
    return {
      ...credential,
      encryptedData: credential.encryptedData ? '[ENCRYPTED]' : null,
    };
  }

  /**
   * Generate a new database credential
   */
  async generateDatabaseCredential(name: string, userId?: string): Promise<Credential> {
    const password = this.encryptionService.generatePassword(20);

    return this.createCredential(
      {
        name,
        type: CredentialType.DATABASE_USER,
        data: {
          username: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          password,
        },
        rotationEnabled: true,
        rotationDays: 90,
      },
      userId,
    );
  }
}
