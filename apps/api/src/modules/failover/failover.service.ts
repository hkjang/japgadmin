import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConnectionManagerService } from '../core/services/connection-manager.service';
import { ReplicationService } from '../replication/replication.service';
import {
  FailoverStatus,
  FailoverType,
  InstanceStatus,
  InstanceRole,
} from '@prisma/client';

export interface FailoverConfig {
  clusterId: string;
  autoFailoverEnabled?: boolean;
  failoverTimeoutSeconds?: number;
  minStandbyLagSeconds?: number;
  preferredStandbyId?: string;
}

export interface ManualFailoverDto {
  clusterId: string;
  newPrimaryId: string;
  force?: boolean;
}

@Injectable()
export class FailoverService {
  private readonly logger = new Logger(FailoverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionManager: ConnectionManagerService,
    private readonly replicationService: ReplicationService,
  ) {}

  // ============ Failover Readiness ============

  async checkFailoverReadiness(clusterId: string): Promise<any> {
    const topology = await this.replicationService.getClusterTopology(clusterId);

    if (!topology.primary) {
      return {
        ready: false,
        reason: 'Primary 서버를 찾을 수 없습니다',
        topology,
      };
    }

    if (topology.standbys.length === 0) {
      return {
        ready: false,
        reason: 'Standby 서버가 없습니다',
        topology,
      };
    }

    // 각 Standby의 failover 적합성 평가
    const candidates = await Promise.all(
      topology.standbys.map(async (standby: any) => {
        const health = await this.replicationService.checkReplicationHealth(standby.instance.id);

        let score = 100;
        const issues: string[] = [];

        // 건강 상태 체크
        if (!standby.healthy) {
          score -= 50;
          issues.push('인스턴스가 건강하지 않음');
        }

        // 복제 지연 체크
        if (standby.replicationLag) {
          if (standby.replicationLag.lagSeconds > 300) {
            score -= 40;
            issues.push(`높은 복제 지연: ${standby.replicationLag.lagSeconds}초`);
          } else if (standby.replicationLag.lagSeconds > 60) {
            score -= 20;
            issues.push(`복제 지연: ${standby.replicationLag.lagSeconds}초`);
          }
        }

        // 복제 건강 체크
        if (health.health === 'critical') {
          score -= 30;
          issues.push(...health.issues);
        } else if (health.health === 'warning') {
          score -= 10;
          issues.push(...health.warnings);
        }

        return {
          instance: standby.instance,
          score: Math.max(0, score),
          suitable: score >= 50,
          issues,
          replicationLag: standby.replicationLag,
        };
      }),
    );

    const suitableCandidates = candidates.filter((c) => c.suitable);
    const bestCandidate = candidates.sort((a, b) => b.score - a.score)[0];

    return {
      ready: suitableCandidates.length > 0,
      reason: suitableCandidates.length > 0 ? null : '적합한 Standby가 없습니다',
      primary: topology.primary,
      candidates,
      bestCandidate,
      timestamp: new Date(),
    };
  }

  // ============ Manual Failover ============

  async initiateFailover(dto: ManualFailoverDto): Promise<any> {
    const cluster = await this.prisma.cluster.findUnique({
      where: { id: dto.clusterId },
      include: {
        instances: true,
      },
    });

    if (!cluster) {
      throw new NotFoundException('클러스터를 찾을 수 없습니다');
    }

    const newPrimary = cluster.instances.find((i) => i.id === dto.newPrimaryId);
    if (!newPrimary) {
      throw new NotFoundException('대상 인스턴스를 찾을 수 없습니다');
    }

    // Failover 가능 여부 확인
    if (!dto.force) {
      const readiness = await this.checkFailoverReadiness(dto.clusterId);
      const candidate = readiness.candidates.find(
        (c: any) => c.instance.id === dto.newPrimaryId,
      );

      if (!candidate || !candidate.suitable) {
        throw new BadRequestException(
          '대상 인스턴스가 failover에 적합하지 않습니다. force 옵션을 사용하세요',
        );
      }
    }

    // 진행 중인 failover가 있는지 확인
    const inProgress = await this.prisma.failoverHistory.findFirst({
      where: {
        clusterId: dto.clusterId,
        status: FailoverStatus.IN_PROGRESS,
      },
    });

    if (inProgress) {
      throw new BadRequestException('이미 진행 중인 failover가 있습니다');
    }

    // 현재 Primary 찾기
    const topology = await this.replicationService.getClusterTopology(dto.clusterId);
    const oldPrimary = topology.primary?.instance;

    // Failover 기록 생성
    const failover = await this.prisma.failoverHistory.create({
      data: {
        clusterId: dto.clusterId,
        previousPrimaryId: oldPrimary?.id || dto.newPrimaryId,
        newPrimaryId: dto.newPrimaryId,
        type: FailoverType.MANUAL,
        status: FailoverStatus.IN_PROGRESS,
        startedAt: new Date(),
        steps: [],
        reason: dto.force ? 'Manual forced failover' : 'Manual failover',
      },
    });

    // Failover 실행 (비동기)
    this.executeFailover(failover.id, oldPrimary, newPrimary, dto.force).catch((error) => {
      this.logger.error(`Failover ${failover.id} failed: ${error.message}`);
    });

    return {
      failoverId: failover.id,
      status: 'initiated',
      oldPrimary: oldPrimary,
      newPrimary: {
        id: newPrimary.id,
        name: newPrimary.name,
        host: newPrimary.host,
      },
      timestamp: new Date(),
    };
  }

  private async executeFailover(
    failoverId: string,
    oldPrimary: any,
    newPrimary: any,
    force: boolean,
  ): Promise<void> {
    const steps: any[] = [];

    try {
      // Step 1: Old Primary 중지 (가능한 경우)
      if (oldPrimary && !force) {
        try {
          steps.push({ step: 'stop_old_primary', status: 'in_progress', startedAt: new Date() });

          // Old primary에 더 이상 쓰기 못하게 설정
          // 실제 구현에서는 pg_terminate_backend 등 사용
          await this.connectionManager.executeQuery(
            oldPrimary.id,
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND state != 'idle'",
          );

          steps[steps.length - 1].status = 'completed';
          steps[steps.length - 1].completedAt = new Date();
        } catch (error) {
          steps[steps.length - 1].status = 'failed';
          steps[steps.length - 1].error = error.message;
          if (!force) throw error;
        }
      }

      await this.updateFailoverSteps(failoverId, steps);

      // Step 2: New Primary로 promote
      steps.push({ step: 'promote_new_primary', status: 'in_progress', startedAt: new Date() });

      // pg_promote() 실행
      await this.connectionManager.executeQuery(newPrimary.id, 'SELECT pg_promote()');

      // Promote 완료 대기 (최대 30초)
      let promoted = false;
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const result = await this.connectionManager.executeQuery(
          newPrimary.id,
          'SELECT pg_is_in_recovery() as is_standby',
        );
        if (!result.rows[0]?.is_standby) {
          promoted = true;
          break;
        }
      }

      if (!promoted) {
        throw new Error('Promote 작업이 타임아웃되었습니다');
      }

      steps[steps.length - 1].status = 'completed';
      steps[steps.length - 1].completedAt = new Date();

      await this.updateFailoverSteps(failoverId, steps);

      // Step 3: 인스턴스 상태 업데이트
      steps.push({ step: 'update_instance_status', status: 'in_progress', startedAt: new Date() });

      // New Primary 업데이트
      await this.prisma.instance.update({
        where: { id: newPrimary.id },
        data: {
          role: InstanceRole.PRIMARY,
          status: InstanceStatus.ONLINE,
        },
      });

      // Old Primary 업데이트 (있는 경우)
      if (oldPrimary) {
        await this.prisma.instance.update({
          where: { id: oldPrimary.id },
          data: {
            role: InstanceRole.STANDBY,
            status: InstanceStatus.DEGRADED,
          },
        });
      }

      steps[steps.length - 1].status = 'completed';
      steps[steps.length - 1].completedAt = new Date();

      // Failover 완료
      await this.prisma.failoverHistory.update({
        where: { id: failoverId },
        data: {
          status: FailoverStatus.COMPLETED,
          completedAt: new Date(),
          steps,
        },
      });

      this.logger.log(`Failover ${failoverId} completed successfully`);
    } catch (error) {
      // Failover 실패
      await this.prisma.failoverHistory.update({
        where: { id: failoverId },
        data: {
          status: FailoverStatus.FAILED,
          completedAt: new Date(),
          errorMessage: error.message,
          steps,
        },
      });

      throw error;
    }
  }

  private async updateFailoverSteps(failoverId: string, steps: any[]): Promise<void> {
    await this.prisma.failoverHistory.update({
      where: { id: failoverId },
      data: { steps },
    });
  }

  // ============ Failover History ============

  async getFailoverHistory(filters: {
    clusterId?: string;
    status?: FailoverStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ failovers: any[]; total: number }> {
    const where: any = {};

    if (filters.clusterId) {
      where.clusterId = filters.clusterId;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const [failovers, total] = await Promise.all([
      this.prisma.failoverHistory.findMany({
        where,
        include: {
          cluster: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.failoverHistory.count({ where }),
    ]);

    return { failovers, total };
  }

  async getFailover(id: string): Promise<any> {
    const failover = await this.prisma.failoverHistory.findUnique({
      where: { id },
      include: {
        cluster: true,
      },
    });

    if (!failover) {
      throw new NotFoundException('Failover 기록을 찾을 수 없습니다');
    }

    return failover;
  }

  // ============ Switchover (Planned Failover) ============

  async initiateSwitchover(clusterId: string, newPrimaryId: string): Promise<any> {
    // Switchover는 계획된 failover로, 데이터 손실 없이 진행
    const readiness = await this.checkFailoverReadiness(clusterId);

    if (!readiness.ready) {
      throw new BadRequestException(`Switchover 불가: ${readiness.reason}`);
    }

    const candidate = readiness.candidates.find(
      (c: any) => c.instance.id === newPrimaryId,
    );

    if (!candidate) {
      throw new NotFoundException('대상 Standby를 찾을 수 없습니다');
    }

    // 복제 지연이 있으면 대기
    if (candidate.replicationLag?.lagSeconds > 5) {
      throw new BadRequestException(
        `복제 지연이 ${candidate.replicationLag.lagSeconds}초입니다. 5초 이하일 때 다시 시도하세요`,
      );
    }

    return this.initiateFailover({
      clusterId,
      newPrimaryId,
      force: false,
    });
  }

  // ============ Auto Failover Configuration ============

  async getAutoFailoverConfig(clusterId: string): Promise<any> {
    const cluster = await this.prisma.cluster.findUnique({
      where: { id: clusterId },
    });

    if (!cluster) {
      throw new NotFoundException('클러스터를 찾을 수 없습니다');
    }

    // 클러스터 tags에서 auto failover 설정 조회
    const tags = (cluster.tags as any) || {};

    return {
      clusterId,
      autoFailoverEnabled: tags.autoFailoverEnabled || false,
      failoverTimeoutSeconds: tags.failoverTimeoutSeconds || 30,
      minStandbyLagSeconds: tags.minStandbyLagSeconds || 60,
      preferredStandbyId: tags.preferredStandbyId || null,
    };
  }

  async updateAutoFailoverConfig(config: FailoverConfig): Promise<any> {
    const cluster = await this.prisma.cluster.findUnique({
      where: { id: config.clusterId },
    });

    if (!cluster) {
      throw new NotFoundException('클러스터를 찾을 수 없습니다');
    }

    const existingTags = (cluster.tags as any) || {};

    const updatedTags = {
      ...existingTags,
      autoFailoverEnabled: config.autoFailoverEnabled ?? existingTags.autoFailoverEnabled,
      failoverTimeoutSeconds: config.failoverTimeoutSeconds ?? existingTags.failoverTimeoutSeconds,
      minStandbyLagSeconds: config.minStandbyLagSeconds ?? existingTags.minStandbyLagSeconds,
      preferredStandbyId: config.preferredStandbyId ?? existingTags.preferredStandbyId,
    };

    await this.prisma.cluster.update({
      where: { id: config.clusterId },
      data: { tags: updatedTags },
    });

    return {
      clusterId: config.clusterId,
      ...updatedTags,
    };
  }
}
