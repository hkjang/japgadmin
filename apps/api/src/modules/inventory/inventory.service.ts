import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConnectionManagerService } from '../core/services/connection-manager.service';
import {
  Cluster,
  Instance,
  Database,
  Environment,
  InstanceStatus,
  Prisma,
} from '@prisma/client';
import {
  CreateClusterDto,
  UpdateClusterDto,
} from './dto/create-cluster.dto';
import {
  CreateInstanceDto,
  UpdateInstanceDto,
  TestConnectionDto,
} from './dto/create-instance.dto';
import {
  CreateDatabaseDto,
  UpdateDatabaseDto,
} from './dto/create-database.dto';

export interface ClusterWithInstances extends Cluster {
  instances: Instance[];
  _count?: { instances: number };
}

export interface InstanceWithDatabases extends Instance {
  databases: Database[];
  cluster: Cluster;
  _count?: { databases: number };
}

export interface InventorySummary {
  totalClusters: number;
  totalInstances: number;
  totalDatabases: number;
  instancesByStatus: Record<InstanceStatus, number>;
  instancesByEnvironment: Record<Environment, number>;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionManager: ConnectionManagerService,
  ) {}

  // ==================== CLUSTERS ====================

  async createCluster(dto: CreateClusterDto, userId?: string): Promise<Cluster> {
    const existing = await this.prisma.cluster.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`클러스터 이름이 이미 존재합니다: ${dto.name}`);
    }

    return this.prisma.cluster.create({
      data: {
        name: dto.name,
        description: dto.description,
        environment: dto.environment || Environment.DEVELOPMENT,
        cloudProvider: dto.cloudProvider,
        region: dto.region,
        tags: dto.tags as any,
        createdById: userId,
      },
    });
  }

  async getClusters(params?: {
    environment?: Environment;
    search?: string;
    skip?: number;
    take?: number;
  }): Promise<{ clusters: ClusterWithInstances[]; total: number }> {
    const where: Prisma.ClusterWhereInput = {};

    if (params?.environment) {
      where.environment = params.environment;
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [clusters, total] = await Promise.all([
      this.prisma.cluster.findMany({
        where,
        include: {
          instances: {
            orderBy: { name: 'asc' },
          },
          _count: { select: { instances: true } },
        },
        orderBy: { name: 'asc' },
        skip: params?.skip,
        take: params?.take,
      }),
      this.prisma.cluster.count({ where }),
    ]);

    return { clusters: clusters as ClusterWithInstances[], total };
  }

  async getClusterById(id: string): Promise<ClusterWithInstances> {
    const cluster = await this.prisma.cluster.findUnique({
      where: { id },
      include: {
        instances: {
          include: {
            _count: { select: { databases: true } },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { instances: true } },
      },
    });

    if (!cluster) {
      throw new NotFoundException(`클러스터를 찾을 수 없습니다: ${id}`);
    }

    return cluster as ClusterWithInstances;
  }

  async updateCluster(id: string, dto: UpdateClusterDto): Promise<Cluster> {
    const existing = await this.prisma.cluster.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`클러스터를 찾을 수 없습니다: ${id}`);
    }

    if (dto.name && dto.name !== existing.name) {
      const nameExists = await this.prisma.cluster.findUnique({
        where: { name: dto.name },
      });
      if (nameExists) {
        throw new ConflictException(`클러스터 이름이 이미 존재합니다: ${dto.name}`);
      }
    }

    return this.prisma.cluster.update({
      where: { id },
      data: {
        ...dto,
        tags: dto.tags as any,
      },
    });
  }

  async deleteCluster(id: string): Promise<void> {
    const existing = await this.prisma.cluster.findUnique({
      where: { id },
      include: { _count: { select: { instances: true } } },
    });

    if (!existing) {
      throw new NotFoundException(`클러스터를 찾을 수 없습니다: ${id}`);
    }

    if (existing._count.instances > 0) {
      throw new ConflictException(
        `클러스터에 ${existing._count.instances}개의 인스턴스가 있습니다. 먼저 인스턴스를 삭제해주세요.`,
      );
    }

    await this.prisma.cluster.delete({ where: { id } });
  }

  // ==================== INSTANCES ====================

  async createInstance(dto: CreateInstanceDto): Promise<Instance> {
    const cluster = await this.prisma.cluster.findUnique({
      where: { id: dto.clusterId },
    });

    if (!cluster) {
      throw new NotFoundException(`클러스터를 찾을 수 없습니다: ${dto.clusterId}`);
    }

    const existing = await this.prisma.instance.findFirst({
      where: {
        clusterId: dto.clusterId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(
        `같은 클러스터에 동일한 이름의 인스턴스가 있습니다: ${dto.name}`,
      );
    }

    return this.prisma.instance.create({
      data: {
        clusterId: dto.clusterId,
        name: dto.name,
        host: dto.host,
        port: dto.port || 5432,
        role: dto.role,
        pgVersion: dto.pgVersion,
        extensions: dto.extensions as any,
        connectionMode: dto.connectionMode,
        sslMode: dto.sslMode,
        maxConnections: dto.maxConnections || 10,
        connectionTimeout: dto.connectionTimeout || 5000,
        credentialId: dto.credentialId,
        status: InstanceStatus.UNKNOWN,
      },
    });
  }

  async getInstances(params?: {
    clusterId?: string;
    status?: InstanceStatus;
    search?: string;
    skip?: number;
    take?: number;
  }): Promise<{ instances: InstanceWithDatabases[]; total: number }> {
    const where: Prisma.InstanceWhereInput = {};

    if (params?.clusterId) {
      where.clusterId = params.clusterId;
    }

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { host: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [instances, total] = await Promise.all([
      this.prisma.instance.findMany({
        where,
        include: {
          cluster: true,
          databases: {
            orderBy: { name: 'asc' },
          },
          _count: { select: { databases: true } },
        },
        orderBy: [{ cluster: { name: 'asc' } }, { name: 'asc' }],
        skip: params?.skip,
        take: params?.take,
      }),
      this.prisma.instance.count({ where }),
    ]);

    return { instances: instances as InstanceWithDatabases[], total };
  }

  async getInstanceById(id: string): Promise<InstanceWithDatabases> {
    const instance = await this.prisma.instance.findUnique({
      where: { id },
      include: {
        cluster: true,
        databases: {
          orderBy: { name: 'asc' },
        },
        credential: true,
        networkConfig: true,
        _count: { select: { databases: true } },
      },
    });

    if (!instance) {
      throw new NotFoundException(`인스턴스를 찾을 수 없습니다: ${id}`);
    }

    return instance as InstanceWithDatabases;
  }

  async updateInstance(id: string, dto: UpdateInstanceDto): Promise<Instance> {
    const existing = await this.prisma.instance.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`인스턴스를 찾을 수 없습니다: ${id}`);
    }

    // If connection parameters changed, refresh the pool
    const connectionChanged =
      dto.host !== undefined ||
      dto.port !== undefined ||
      dto.credentialId !== undefined ||
      dto.sslMode !== undefined;

    const updated = await this.prisma.instance.update({
      where: { id },
      data: {
        ...dto,
        extensions: dto.extensions as any,
      },
    });

    if (connectionChanged) {
      await this.connectionManager.closePool(id);
    }

    return updated;
  }

  async deleteInstance(id: string): Promise<void> {
    const existing = await this.prisma.instance.findUnique({
      where: { id },
      include: { _count: { select: { databases: true } } },
    });

    if (!existing) {
      throw new NotFoundException(`인스턴스를 찾을 수 없습니다: ${id}`);
    }

    // Close connection pool
    await this.connectionManager.closePool(id);

    await this.prisma.instance.delete({ where: { id } });
  }

  async testInstanceConnection(id: string) {
    const result = await this.connectionManager.testConnection(id);

    // Update instance status
    await this.prisma.instance.update({
      where: { id },
      data: {
        status: result.success ? InstanceStatus.ONLINE : InstanceStatus.OFFLINE,
        lastSeenAt: result.success ? new Date() : undefined,
        pgVersion: result.version ? this.extractPgVersion(result.version) : undefined,
      },
    });

    return result;
  }

  async testConnection(dto: TestConnectionDto) {
    return this.connectionManager.testConnectionWithParams({
      host: dto.host,
      port: dto.port,
      database: dto.database,
      username: dto.username,
      password: dto.password,
      sslMode: dto.sslMode,
    });
  }

  // ==================== DATABASES ====================

  async createDatabase(dto: CreateDatabaseDto): Promise<Database> {
    const instance = await this.prisma.instance.findUnique({
      where: { id: dto.instanceId },
    });

    if (!instance) {
      throw new NotFoundException(`인스턴스를 찾을 수 없습니다: ${dto.instanceId}`);
    }

    const existing = await this.prisma.database.findFirst({
      where: {
        instanceId: dto.instanceId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(
        `같은 인스턴스에 동일한 이름의 데이터베이스가 있습니다: ${dto.name}`,
      );
    }

    return this.prisma.database.create({
      data: {
        instanceId: dto.instanceId,
        name: dto.name,
        owner: dto.owner,
        encoding: dto.encoding,
        collation: dto.collation,
        readOnly: dto.readOnly,
        requireApproval: dto.requireApproval,
      },
    });
  }

  async getDatabases(params?: {
    instanceId?: string;
    search?: string;
    skip?: number;
    take?: number;
  }): Promise<{ databases: Database[]; total: number }> {
    const where: Prisma.DatabaseWhereInput = {};

    if (params?.instanceId) {
      where.instanceId = params.instanceId;
    }

    if (params?.search) {
      where.name = { contains: params.search, mode: 'insensitive' };
    }

    const [databases, total] = await Promise.all([
      this.prisma.database.findMany({
        where,
        include: {
          instance: {
            include: { cluster: true },
          },
        },
        orderBy: { name: 'asc' },
        skip: params?.skip,
        take: params?.take,
      }),
      this.prisma.database.count({ where }),
    ]);

    return { databases, total };
  }

  async getDatabaseById(id: string): Promise<Database> {
    const database = await this.prisma.database.findUnique({
      where: { id },
      include: {
        instance: {
          include: { cluster: true },
        },
      },
    });

    if (!database) {
      throw new NotFoundException(`데이터베이스를 찾을 수 없습니다: ${id}`);
    }

    return database;
  }

  async updateDatabase(id: string, dto: UpdateDatabaseDto): Promise<Database> {
    const existing = await this.prisma.database.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`데이터베이스를 찾을 수 없습니다: ${id}`);
    }

    return this.prisma.database.update({
      where: { id },
      data: dto,
    });
  }

  async deleteDatabase(id: string): Promise<void> {
    const existing = await this.prisma.database.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`데이터베이스를 찾을 수 없습니다: ${id}`);
    }

    await this.prisma.database.delete({ where: { id } });
  }

  // ==================== DISCOVERY ====================

  async discoverDatabases(instanceId: string): Promise<Database[]> {
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new NotFoundException(`인스턴스를 찾을 수 없습니다: ${instanceId}`);
    }

    // Query database list from PostgreSQL
    const databases = await this.connectionManager.queryMany<{
      datname: string;
      datdba: string;
      encoding: string;
      datcollate: string;
      pg_database_size: string;
    }>(
      instanceId,
      `
      SELECT
        datname,
        pg_catalog.pg_get_userbyid(datdba) as datdba,
        pg_catalog.pg_encoding_to_char(encoding) as encoding,
        datcollate,
        pg_database_size(datname)::text as pg_database_size
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname
    `,
    );

    const createdDatabases: Database[] = [];

    for (const db of databases) {
      // Check if already exists
      const existing = await this.prisma.database.findFirst({
        where: {
          instanceId,
          name: db.datname,
        },
      });

      if (!existing) {
        const created = await this.prisma.database.create({
          data: {
            instanceId,
            name: db.datname,
            owner: db.datdba,
            encoding: db.encoding,
            collation: db.datcollate,
            sizeBytes: BigInt(db.pg_database_size),
          },
        });
        createdDatabases.push(created);
      } else {
        // Update size
        await this.prisma.database.update({
          where: { id: existing.id },
          data: {
            sizeBytes: BigInt(db.pg_database_size),
            owner: db.datdba,
          },
        });
      }
    }

    return createdDatabases;
  }

  async discoverExtensions(instanceId: string): Promise<string[]> {
    const extensions = await this.connectionManager.queryMany<{ extname: string }>(
      instanceId,
      'SELECT extname FROM pg_extension ORDER BY extname',
    );

    const extNames = extensions.map((e) => e.extname);

    await this.prisma.instance.update({
      where: { id: instanceId },
      data: { extensions: extNames },
    });

    return extNames;
  }

  // ==================== SUMMARY ====================

  async getInventorySummary(): Promise<InventorySummary> {
    const [
      totalClusters,
      totalInstances,
      totalDatabases,
      instancesByStatus,
      clustersByEnvironment,
    ] = await Promise.all([
      this.prisma.cluster.count(),
      this.prisma.instance.count(),
      this.prisma.database.count(),
      this.prisma.instance.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.cluster.groupBy({
        by: ['environment'],
        _count: { _all: true },
      }),
    ]);

    const statusMap = {} as Record<InstanceStatus, number>;
    for (const status of Object.values(InstanceStatus)) {
      statusMap[status] = 0;
    }
    for (const item of instancesByStatus) {
      statusMap[item.status] = item._count;
    }

    const envMap = {} as Record<Environment, number>;
    for (const env of Object.values(Environment)) {
      envMap[env] = 0;
    }
    for (const item of clustersByEnvironment) {
      envMap[item.environment] = item._count._all;
    }

    return {
      totalClusters,
      totalInstances,
      totalDatabases,
      instancesByStatus: statusMap,
      instancesByEnvironment: envMap,
    };
  }

  // ==================== HEALTH CHECK ====================

  async checkAllInstancesHealth(): Promise<void> {
    const instances = await this.prisma.instance.findMany({
      select: { id: true },
    });

    for (const instance of instances) {
      try {
        await this.testInstanceConnection(instance.id);
      } catch (error) {
        this.logger.error(`Health check failed for instance ${instance.id}:`, error);
      }
    }
  }

  private extractPgVersion(versionString: string): string {
    const match = versionString.match(/PostgreSQL (\d+\.\d+)/);
    return match ? match[1] : versionString.substring(0, 50);
  }
}
