import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConnectionManagerService } from '../core/services/connection-manager.service';
import { BackupStatus, BackupType, BackupProvider } from '@prisma/client';

export interface CreateBackupConfigDto {
  instanceId: string;
  provider: BackupProvider;
  config: {
    s3Bucket?: string;
    s3Region?: string;
    localPath?: string;
    compression?: boolean;
    encryptionKey?: string;
  };
  fullBackupCron?: string;
  incrementalBackupCron?: string;
  retentionDays?: number;
}

export interface UpdateBackupConfigDto {
  provider?: BackupProvider;
  config?: Record<string, any>;
  fullBackupCron?: string;
  incrementalBackupCron?: string;
  retentionDays?: number;
  enabled?: boolean;
}

export interface CreateBackupDto {
  configId: string;
  type: BackupType;
  description?: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionManager: ConnectionManagerService,
  ) {}

  // ============ Backup Configuration ============

  async createBackupConfig(dto: CreateBackupConfigDto): Promise<any> {
    const instance = await this.prisma.instance.findUnique({
      where: { id: dto.instanceId },
    });

    if (!instance) {
      throw new NotFoundException('인스턴스를 찾을 수 없습니다');
    }

    // 이미 설정이 있는지 확인
    const existing = await this.prisma.backupConfig.findFirst({
      where: { instanceId: dto.instanceId },
    });

    if (existing) {
      throw new BadRequestException('이미 백업 설정이 존재합니다. 업데이트를 사용하세요');
    }

    return this.prisma.backupConfig.create({
      data: {
        instanceId: dto.instanceId,
        provider: dto.provider,
        config: dto.config,
        fullBackupCron: dto.fullBackupCron || '0 2 * * 0', // 기본: 매주 일요일 02:00
        incrementalBackupCron: dto.incrementalBackupCron,
        retentionDays: dto.retentionDays || 30,
        enabled: true,
      },
    });
  }

  async getBackupConfigs(instanceId?: string): Promise<any[]> {
    const where = instanceId ? { instanceId } : {};

    return this.prisma.backupConfig.findMany({
      where,
      include: {
        instance: {
          select: {
            id: true,
            name: true,
            host: true,
            cluster: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: { backups: true },
        },
      },
    });
  }

  async getBackupConfig(id: string): Promise<any> {
    const config = await this.prisma.backupConfig.findUnique({
      where: { id },
      include: {
        instance: true,
        backups: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!config) {
      throw new NotFoundException('백업 설정을 찾을 수 없습니다');
    }

    return config;
  }

  async updateBackupConfig(id: string, dto: UpdateBackupConfigDto): Promise<any> {
    const config = await this.prisma.backupConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException('백업 설정을 찾을 수 없습니다');
    }

    return this.prisma.backupConfig.update({
      where: { id },
      data: {
        provider: dto.provider,
        config: dto.config,
        fullBackupCron: dto.fullBackupCron,
        incrementalBackupCron: dto.incrementalBackupCron,
        retentionDays: dto.retentionDays,
        enabled: dto.enabled,
      },
    });
  }

  async deleteBackupConfig(id: string): Promise<void> {
    const config = await this.prisma.backupConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException('백업 설정을 찾을 수 없습니다');
    }

    await this.prisma.backupConfig.delete({
      where: { id },
    });
  }

  // ============ Backup Management ============

  async createBackup(dto: CreateBackupDto): Promise<any> {
    const config = await this.prisma.backupConfig.findUnique({
      where: { id: dto.configId },
      include: { instance: true },
    });

    if (!config) {
      throw new NotFoundException('백업 설정을 찾을 수 없습니다');
    }

    // 진행 중인 백업이 있는지 확인
    const inProgress = await this.prisma.backup.findFirst({
      where: {
        configId: dto.configId,
        status: BackupStatus.IN_PROGRESS,
      },
    });

    if (inProgress) {
      throw new BadRequestException('이미 진행 중인 백업이 있습니다');
    }

    // WAL 위치 조회
    let walStart: string | null = null;
    try {
      const walResult = await this.connectionManager.executeQuery(
        config.instanceId,
        'SELECT pg_current_wal_lsn()::text as lsn',
      );
      walStart = walResult.rows[0]?.lsn;
    } catch {
      // WAL 조회 실패해도 계속 진행
    }

    const backup = await this.prisma.backup.create({
      data: {
        configId: dto.configId,
        type: dto.type,
        status: BackupStatus.IN_PROGRESS,
        startedAt: new Date(),
        walStart,
        description: dto.description,
      },
    });

    // 백업 실행 (비동기로 처리)
    this.executeBackup(backup.id, config).catch((error) => {
      this.logger.error(`Backup ${backup.id} failed: ${error.message}`);
    });

    return backup;
  }

  private async executeBackup(backupId: string, config: any): Promise<void> {
    try {
      // 실제 백업 로직 (pg_dump 실행 등)
      // 여기서는 시뮬레이션만 수행
      this.logger.log(`Starting backup ${backupId} for instance ${config.instanceId}`);

      // pg_dump를 실행하는 실제 로직은 provider별로 구현
      const startTime = Date.now();

      // 데이터베이스 크기 조회
      const sizeResult = await this.connectionManager.executeQuery(
        config.instanceId,
        'SELECT pg_database_size(current_database()) as size',
      );
      const dbSize = sizeResult.rows[0]?.size || 0;

      // WAL 종료 위치 조회
      let walEnd: string | null = null;
      try {
        const walResult = await this.connectionManager.executeQuery(
          config.instanceId,
          'SELECT pg_current_wal_lsn()::text as lsn',
        );
        walEnd = walResult.rows[0]?.lsn;
      } catch {
        // WAL 조회 실패해도 계속 진행
      }

      const duration = Date.now() - startTime;

      // 백업 완료 업데이트
      await this.prisma.backup.update({
        where: { id: backupId },
        data: {
          status: BackupStatus.COMPLETED,
          completedAt: new Date(),
          sizeBytes: BigInt(dbSize),
          walEnd,
          pitrStartTime: new Date(),
          pitrEndTime: new Date(),
        },
      });

      this.logger.log(`Backup ${backupId} completed in ${duration}ms`);
    } catch (error) {
      await this.prisma.backup.update({
        where: { id: backupId },
        data: {
          status: BackupStatus.FAILED,
          completedAt: new Date(),
          errorMessage: error.message,
        },
      });
      throw error;
    }
  }

  async getBackups(filters: {
    configId?: string;
    instanceId?: string;
    status?: BackupStatus;
    type?: BackupType;
    limit?: number;
    offset?: number;
  }): Promise<{ backups: any[]; total: number }> {
    const where: any = {};

    if (filters.configId) {
      where.configId = filters.configId;
    }
    if (filters.instanceId) {
      where.config = { instanceId: filters.instanceId };
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.type) {
      where.type = filters.type;
    }

    const [backups, total] = await Promise.all([
      this.prisma.backup.findMany({
        where,
        include: {
          config: {
            include: {
              instance: {
                select: {
                  id: true,
                  name: true,
                  host: true,
                },
              },
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.backup.count({ where }),
    ]);

    return { backups, total };
  }

  async getBackup(id: string): Promise<any> {
    const backup = await this.prisma.backup.findUnique({
      where: { id },
      include: {
        config: {
          include: {
            instance: true,
          },
        },
      },
    });

    if (!backup) {
      throw new NotFoundException('백업을 찾을 수 없습니다');
    }

    return backup;
  }

  async deleteBackup(id: string): Promise<void> {
    const backup = await this.prisma.backup.findUnique({
      where: { id },
    });

    if (!backup) {
      throw new NotFoundException('백업을 찾을 수 없습니다');
    }

    if (backup.status === BackupStatus.IN_PROGRESS) {
      throw new BadRequestException('진행 중인 백업은 삭제할 수 없습니다');
    }

    // TODO: 실제 백업 파일 삭제 로직

    await this.prisma.backup.update({
      where: { id },
      data: { status: BackupStatus.EXPIRED },
    });
  }

  // ============ PITR (Point-in-Time Recovery) ============

  async getPitrRange(instanceId: string): Promise<any> {
    const config = await this.prisma.backupConfig.findFirst({
      where: { instanceId },
    });

    if (!config) {
      return {
        available: false,
        message: '백업 설정이 없습니다',
      };
    }

    // 최신 완료된 백업 조회
    const latestBackup = await this.prisma.backup.findFirst({
      where: {
        configId: config.id,
        status: BackupStatus.COMPLETED,
      },
      orderBy: { completedAt: 'desc' },
    });

    if (!latestBackup) {
      return {
        available: false,
        message: '완료된 백업이 없습니다',
      };
    }

    // WAL 아카이브 상태 확인
    let walArchiveStatus = null;
    try {
      const walResult = await this.connectionManager.executeQuery(
        instanceId,
        `SELECT
          last_archived_wal,
          last_archived_time,
          last_failed_wal,
          last_failed_time
        FROM pg_stat_archiver`,
      );
      walArchiveStatus = walResult.rows[0];
    } catch {
      // WAL 아카이브 조회 실패
    }

    return {
      available: true,
      oldestRestorePoint: latestBackup.pitrStartTime,
      newestRestorePoint: walArchiveStatus?.last_archived_time || latestBackup.pitrEndTime,
      latestBackup: {
        id: latestBackup.id,
        type: latestBackup.type,
        completedAt: latestBackup.completedAt,
      },
      walArchive: walArchiveStatus,
    };
  }

  async estimateRecoveryTime(instanceId: string, targetTime: Date): Promise<any> {
    const pitrRange = await this.getPitrRange(instanceId);

    if (!pitrRange.available) {
      throw new BadRequestException(pitrRange.message);
    }

    if (targetTime < pitrRange.oldestRestorePoint || targetTime > pitrRange.newestRestorePoint) {
      throw new BadRequestException('대상 시간이 복구 가능 범위를 벗어났습니다');
    }

    // 예상 복구 시간 계산 (대략적인 추정)
    const latestBackup = await this.prisma.backup.findFirst({
      where: {
        config: { instanceId },
        status: BackupStatus.COMPLETED,
        pitrStartTime: { lte: targetTime },
      },
      orderBy: { completedAt: 'desc' },
    });

    if (!latestBackup) {
      throw new BadRequestException('대상 시간 이전의 백업을 찾을 수 없습니다');
    }

    const backupSizeGB = Number(latestBackup.sizeBytes) / (1024 * 1024 * 1024);
    const walReplayTime = Math.abs(targetTime.getTime() - (latestBackup.pitrEndTime?.getTime() || 0)) / 1000;

    // 대략적인 예상: 백업 복원 1GB당 1분 + WAL 재생 시간당 0.1초
    const estimatedMinutes = backupSizeGB * 1 + (walReplayTime * 0.1) / 60;

    return {
      targetTime,
      baseBackup: {
        id: latestBackup.id,
        completedAt: latestBackup.completedAt,
        sizeBytes: latestBackup.sizeBytes,
      },
      estimatedRecoveryMinutes: Math.ceil(estimatedMinutes),
      walReplaySeconds: Math.ceil(walReplayTime),
    };
  }

  // ============ Backup Statistics ============

  async getBackupStatistics(instanceId?: string): Promise<any> {
    const where = instanceId
      ? { config: { instanceId } }
      : {};

    const [total, completed, failed, inProgress] = await Promise.all([
      this.prisma.backup.count({ where }),
      this.prisma.backup.count({ where: { ...where, status: BackupStatus.COMPLETED } }),
      this.prisma.backup.count({ where: { ...where, status: BackupStatus.FAILED } }),
      this.prisma.backup.count({ where: { ...where, status: BackupStatus.IN_PROGRESS } }),
    ]);

    // 최근 7일간 백업 통계
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentBackups = await this.prisma.backup.findMany({
      where: {
        ...where,
        startedAt: { gte: sevenDaysAgo },
        status: BackupStatus.COMPLETED,
      },
      select: {
        sizeBytes: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const totalSizeBytes = recentBackups.reduce(
      (sum, b) => sum + Number(b.sizeBytes || 0),
      0,
    );

    const avgDurationMs =
      recentBackups.length > 0
        ? recentBackups.reduce((sum, b) => {
            if (b.completedAt && b.startedAt) {
              return sum + (b.completedAt.getTime() - b.startedAt.getTime());
            }
            return sum;
          }, 0) / recentBackups.length
        : 0;

    return {
      total,
      completed,
      failed,
      inProgress,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      last7Days: {
        count: recentBackups.length,
        totalSizeBytes,
        avgDurationMs: Math.round(avgDurationMs),
      },
    };
  }
}
