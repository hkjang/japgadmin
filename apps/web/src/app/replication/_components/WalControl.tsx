'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replicationApi } from '@/lib/api';
import { Play, Pause, RefreshCw, HardDrive, Activity } from 'lucide-react';

interface WalStats {
  current_lsn: string;
  total_wal_bytes: number;
  wal_files_count: number;
  wal_files_size: number;
}

interface RecoveryInfo {
  replay_paused: boolean;
  receive_lsn: string;
  replay_lsn: string;
  last_replay_time: string;
}

interface WalControlProps {
  instanceId: string;
  role: 'primary' | 'standby';
  walStats?: WalStats;
  recoveryInfo?: RecoveryInfo;
}

export default function WalControl({ instanceId, role, walStats, recoveryInfo }: WalControlProps) {
  const queryClient = useQueryClient();

  const switchWalMutation = useMutation({
    mutationFn: () => replicationApi.switchWal(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replication-status', instanceId] });
      alert('WAL 파일이 전환되었습니다 (Switch WAL)');
    },
    onError: (error: any) => {
      alert(`WAL 전환 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const pauseReplayMutation = useMutation({
    mutationFn: () => replicationApi.pauseWalReplay(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replication-status', instanceId] });
    },
  });

  const resumeReplayMutation = useMutation({
    mutationFn: () => replicationApi.resumeWalReplay(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replication-status', instanceId] });
    },
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-postgres-400" />
          WAL & 복구 제어
        </h3>
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            role === 'primary' ? 'bg-postgres-500/20 text-postgres-400' : 'bg-gray-600/50 text-gray-300'
          }`}
        >
          {role.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Statistics Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            통계 정보
          </h4>
          
          <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
            {role === 'primary' && walStats ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Current LSN</span>
                  <span className="text-white font-mono">{walStats.current_lsn}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">WAL 파일 수</span>
                  <span className="text-white">{walStats.wal_files_count}개</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">WAL 총 크기</span>
                  <span className="text-white">{formatBytes(Number(walStats.wal_files_size))}</span>
                </div>
              </>
            ) : role === 'standby' && recoveryInfo ? (
              <>
                 <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Receive LSN</span>
                  <span className="text-white font-mono">{recoveryInfo.receive_lsn}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Replay LSN</span>
                  <span className="text-white font-mono">{recoveryInfo.replay_lsn}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Replay 상태</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      recoveryInfo.replay_paused
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {recoveryInfo.replay_paused ? 'Paused' : 'Active'}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-2">통계 정보 없음</div>
            )}
          </div>
        </div>

        {/* Actions Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-400">작업</h4>
          
          <div className="bg-gray-800/50 rounded-lg p-4">
            {role === 'primary' ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-gray-400 mb-2">
                  현재 WAL 파일을 닫고 새로운 WAL 파일을 생성합니다. 아카이빙을 즉시 트리거할 때 유용합니다.
                </p>
                <button
                  onClick={() => switchWalMutation.mutate()}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded transition-colors w-full"
                  disabled={switchWalMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 ${switchWalMutation.isPending ? 'animate-spin' : ''}`} />
                  Switch WAL
                </button>
              </div>
            ) : role === 'standby' && recoveryInfo ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-gray-400 mb-2">
                  WAL Replay를 일시 중지하거나 재개합니다. 디스크 공간 부족 등의 문제가 발생했을 때 유용합니다.
                </p>
                {recoveryInfo.replay_paused ? (
                  <button
                    onClick={() => resumeReplayMutation.mutate()}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors w-full"
                    disabled={resumeReplayMutation.isPending}
                  >
                    <Play className="w-4 h-4" />
                    Replay 재개
                  </button>
                ) : (
                  <button
                    onClick={() => pauseReplayMutation.mutate()}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors w-full"
                    disabled={pauseReplayMutation.isPending}
                  >
                    <Pause className="w-4 h-4" />
                    Replay 일시 중지
                  </button>
                )}
              </div>
            ) : (
               <div className="text-center text-gray-500 py-2">가능한 작업 없음</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
