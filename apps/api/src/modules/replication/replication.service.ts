import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConnectionManagerService } from '../core/services/connection-manager.service';
import { ReplicationRole, ReplicationState, InstanceStatus } from '@prisma/client';

export interface ReplicationSlotInfo {
  slotName: string;
  slotType: string;
  active: boolean;
  xmin: string | null;
  catalogXmin: string | null;
  restartLsn: string | null;
  confirmedFlushLsn: string | null;
  walStatus: string;
  safeWalSize: number | null;
}

export interface StandbyStatus {
  clientAddr: string;
  state: string;
  sentLsn: string;
  writeLsn: string;
  flushLsn: string;
  replayLsn: string;
  writeLag: string | null;
  flushLag: string | null;
  replayLag: string | null;
  syncState: string;
  syncPriority: number;
}

export interface ReplicationLag {
  lagBytes: number;
  lagSeconds: number | null;
  lastReceiveTime: Date | null;
  lastReplayTime: Date | null;
}

@Injectable()
export class ReplicationService {
  private readonly logger = new Logger(ReplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionManager: ConnectionManagerService,
  ) {}

  // ============ Replication Status ============

  async getReplicationStatus(instanceId: string): Promise<any> {
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      include: {
        cluster: true,
      },
    });

    if (!instance) {
      throw new NotFoundException('인스턴스를 찾을 수 없습니다');
    }

    // 복제 역할 확인
    const roleResult = await this.connectionManager.executeQuery(
      instanceId,
      'SELECT pg_is_in_recovery() as is_standby',
    );
    const isStandby = roleResult.rows[0]?.is_standby;

    if (isStandby) {
      return this.getStandbyReplicationStatus(instanceId, instance);
    } else {
      return this.getPrimaryReplicationStatus(instanceId, instance);
    }
  }

  private async getPrimaryReplicationStatus(instanceId: string, instance: any): Promise<any> {
    // Primary 서버 정보 조회
    const [standbys, slots, walStats, archiveStats] = await Promise.all([
      this.getStandbyList(instanceId),
      this.getReplicationSlots(instanceId),
      this.getWalStatistics(instanceId),
      this.getArchiveStatistics(instanceId),
    ]);

    return {
      role: 'primary',
      instance: {
        id: instance.id,
        name: instance.name,
        host: instance.host,
        port: instance.port,
      },
      cluster: instance.cluster,
      standbys,
      replicationSlots: slots,
      wal: walStats,
      archive: archiveStats,
      timestamp: new Date(),
    };
  }

  private async getStandbyReplicationStatus(instanceId: string, instance: any): Promise<any> {
    // Standby 서버 정보 조회
    const receiverStatus = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        pid,
        status,
        receive_start_lsn,
        receive_start_tli,
        received_lsn,
        received_tli,
        last_msg_send_time,
        last_msg_receipt_time,
        latest_end_lsn,
        latest_end_time,
        slot_name,
        sender_host,
        sender_port,
        conninfo
      FROM pg_stat_wal_receiver`,
    );

    // 복제 지연 계산
    const lagInfo = await this.calculateReplicationLag(instanceId);

    // 복구 상태
    const recoveryInfo = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        pg_last_wal_receive_lsn() as receive_lsn,
        pg_last_wal_replay_lsn() as replay_lsn,
        pg_last_xact_replay_timestamp() as last_replay_time,
        pg_is_wal_replay_paused() as replay_paused`,
    );

    return {
      role: 'standby',
      instance: {
        id: instance.id,
        name: instance.name,
        host: instance.host,
        port: instance.port,
      },
      cluster: instance.cluster,
      receiver: receiverStatus.rows[0] || null,
      recovery: recoveryInfo.rows[0],
      lag: lagInfo,
      timestamp: new Date(),
    };
  }

  async getStandbyList(instanceId: string): Promise<StandbyStatus[]> {
    const result = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        client_addr,
        state,
        sent_lsn::text,
        write_lsn::text,
        flush_lsn::text,
        replay_lsn::text,
        write_lag::text,
        flush_lag::text,
        replay_lag::text,
        sync_state,
        sync_priority
      FROM pg_stat_replication
      ORDER BY sync_priority, client_addr`,
    );

    return result.rows.map((row) => ({
      clientAddr: row.client_addr,
      state: row.state,
      sentLsn: row.sent_lsn,
      writeLsn: row.write_lsn,
      flushLsn: row.flush_lsn,
      replayLsn: row.replay_lsn,
      writeLag: row.write_lag,
      flushLag: row.flush_lag,
      replayLag: row.replay_lag,
      syncState: row.sync_state,
      syncPriority: row.sync_priority,
    }));
  }

  async getReplicationSlots(instanceId: string): Promise<ReplicationSlotInfo[]> {
    const result = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        slot_name,
        slot_type,
        active,
        xmin::text,
        catalog_xmin::text,
        restart_lsn::text,
        confirmed_flush_lsn::text,
        wal_status,
        safe_wal_size
      FROM pg_replication_slots
      ORDER BY slot_name`,
    );

    return result.rows.map((row) => ({
      slotName: row.slot_name,
      slotType: row.slot_type,
      active: row.active,
      xmin: row.xmin,
      catalogXmin: row.catalog_xmin,
      restartLsn: row.restart_lsn,
      confirmedFlushLsn: row.confirmed_flush_lsn,
      walStatus: row.wal_status,
      safeWalSize: row.safe_wal_size,
    }));
  }

  private async getWalStatistics(instanceId: string): Promise<any> {
    const result = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        pg_current_wal_lsn()::text as current_lsn,
        pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0') as total_wal_bytes,
        (SELECT count(*) FROM pg_ls_waldir()) as wal_files_count,
        (SELECT sum(size) FROM pg_ls_waldir()) as wal_files_size`,
    );

    return result.rows[0];
  }

  private async getArchiveStatistics(instanceId: string): Promise<any> {
    try {
      const result = await this.connectionManager.executeQuery(
        instanceId,
        `SELECT
          archived_count,
          last_archived_wal,
          last_archived_time,
          failed_count,
          last_failed_wal,
          last_failed_time,
          stats_reset
        FROM pg_stat_archiver`,
      );

      return result.rows[0];
    } catch {
      return null;
    }
  }

  private async calculateReplicationLag(instanceId: string): Promise<ReplicationLag> {
    const result = await this.connectionManager.executeQuery(
      instanceId,
      `SELECT
        CASE
          WHEN pg_last_wal_receive_lsn() IS NOT NULL AND pg_last_wal_replay_lsn() IS NOT NULL
          THEN pg_wal_lsn_diff(pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn())
          ELSE 0
        END as lag_bytes,
        EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::integer as lag_seconds,
        pg_last_xact_replay_timestamp() as last_replay_time`,
    );

    const row = result.rows[0];

    return {
      lagBytes: parseInt(row?.lag_bytes || '0', 10),
      lagSeconds: row?.lag_seconds,
      lastReceiveTime: null,
      lastReplayTime: row?.last_replay_time,
    };
  }

  // ============ Replication Slot Management ============

  async createReplicationSlot(instanceId: string, slotName: string, isLogical: boolean = false): Promise<any> {
    // 슬롯 이름 유효성 검사
    if (!/^[a-z0-9_]+$/.test(slotName)) {
      throw new BadRequestException('슬롯 이름은 소문자, 숫자, 밑줄만 사용할 수 있습니다');
    }

    const query = isLogical
      ? `SELECT pg_create_logical_replication_slot($1, 'pgoutput')`
      : `SELECT pg_create_physical_replication_slot($1)`;

    await this.connectionManager.executeQuery(instanceId, query, [slotName]);

    this.logger.log(`Created ${isLogical ? 'logical' : 'physical'} replication slot: ${slotName}`);

    return { success: true, slotName, type: isLogical ? 'logical' : 'physical' };
  }

  async dropReplicationSlot(instanceId: string, slotName: string): Promise<any> {
    await this.connectionManager.executeQuery(
      instanceId,
      'SELECT pg_drop_replication_slot($1)',
      [slotName],
    );

    this.logger.log(`Dropped replication slot: ${slotName}`);

    return { success: true, slotName };
  }

  // ============ Cluster Topology ============

  async getClusterTopology(clusterId: string): Promise<any> {
    const cluster = await this.prisma.cluster.findUnique({
      where: { id: clusterId },
      include: {
        instances: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!cluster) {
      throw new NotFoundException('클러스터를 찾을 수 없습니다');
    }

    const topology = await Promise.all(
      cluster.instances.map(async (instance) => {
        try {
          const roleResult = await this.connectionManager.executeQuery(
            instance.id,
            'SELECT pg_is_in_recovery() as is_standby',
          );
          const isStandby = roleResult.rows[0]?.is_standby;

          let lag = null;
          if (isStandby) {
            lag = await this.calculateReplicationLag(instance.id);
          }

          return {
            instance: {
              id: instance.id,
              name: instance.name,
              host: instance.host,
              port: instance.port,
              status: instance.status,
            },
            role: isStandby ? 'standby' : 'primary',
            replicationLag: lag,
            healthy: instance.status === InstanceStatus.HEALTHY,
          };
        } catch (error) {
          return {
            instance: {
              id: instance.id,
              name: instance.name,
              host: instance.host,
              port: instance.port,
              status: instance.status,
            },
            role: 'unknown',
            replicationLag: null,
            healthy: false,
            error: error.message,
          };
        }
      }),
    );

    const primary = topology.find((t) => t.role === 'primary');
    const standbys = topology.filter((t) => t.role === 'standby');

    return {
      cluster: {
        id: cluster.id,
        name: cluster.name,
        environment: cluster.environment,
      },
      primary,
      standbys,
      topology,
      timestamp: new Date(),
    };
  }

  // ============ Replication Health Check ============

  async checkReplicationHealth(instanceId: string): Promise<any> {
    const status = await this.getReplicationStatus(instanceId);
    const issues: string[] = [];
    const warnings: string[] = [];

    if (status.role === 'primary') {
      // Primary 건강 체크
      if (!status.standbys || status.standbys.length === 0) {
        warnings.push('활성 Standby가 없습니다');
      }

      // 동기 복제 체크
      const syncStandbys = status.standbys?.filter((s: any) => s.syncState === 'sync') || [];
      if (syncStandbys.length === 0) {
        warnings.push('동기 Standby가 없습니다');
      }

      // 복제 슬롯 체크
      const inactiveSlots = status.replicationSlots?.filter((s: any) => !s.active) || [];
      if (inactiveSlots.length > 0) {
        warnings.push(`비활성 복제 슬롯 ${inactiveSlots.length}개가 있습니다`);
      }

      // WAL 누적 체크
      for (const slot of status.replicationSlots || []) {
        if (slot.walStatus === 'lost') {
          issues.push(`복제 슬롯 ${slot.slotName}의 WAL이 손실되었습니다`);
        } else if (slot.walStatus === 'unreserved') {
          warnings.push(`복제 슬롯 ${slot.slotName}의 WAL이 예약되지 않았습니다`);
        }
      }

      // 아카이브 실패 체크
      if (status.archive?.failed_count > 0) {
        warnings.push(`WAL 아카이브 실패 ${status.archive.failed_count}건`);
      }
    } else {
      // Standby 건강 체크
      if (!status.receiver) {
        issues.push('WAL receiver가 실행 중이 아닙니다');
      }

      // 복제 지연 체크
      if (status.lag?.lagSeconds > 300) {
        issues.push(`복제 지연이 ${status.lag.lagSeconds}초입니다 (임계값: 300초)`);
      } else if (status.lag?.lagSeconds > 60) {
        warnings.push(`복제 지연이 ${status.lag.lagSeconds}초입니다`);
      }

      // WAL replay 일시 정지 체크
      if (status.recovery?.replay_paused) {
        warnings.push('WAL replay가 일시 정지되어 있습니다');
      }
    }

    const health = issues.length === 0 ? (warnings.length === 0 ? 'healthy' : 'warning') : 'critical';

    return {
      instanceId,
      role: status.role,
      health,
      issues,
      warnings,
      details: status,
      timestamp: new Date(),
    };
  }

  // ============ WAL Management ============

  async pauseWalReplay(instanceId: string): Promise<any> {
    await this.connectionManager.executeQuery(instanceId, 'SELECT pg_wal_replay_pause()');
    this.logger.log(`WAL replay paused on instance ${instanceId}`);
    return { success: true, action: 'pause' };
  }

  async resumeWalReplay(instanceId: string): Promise<any> {
    await this.connectionManager.executeQuery(instanceId, 'SELECT pg_wal_replay_resume()');
    this.logger.log(`WAL replay resumed on instance ${instanceId}`);
    return { success: true, action: 'resume' };
  }

  async switchWal(instanceId: string): Promise<any> {
    const result = await this.connectionManager.executeQuery(
      instanceId,
      'SELECT pg_switch_wal()::text as new_wal',
    );
    this.logger.log(`WAL switched on instance ${instanceId}`);
    return { success: true, newWal: result.rows[0]?.new_wal };
  }
}
