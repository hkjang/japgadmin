'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { replicationApi, failoverApi, inventoryApi } from '@/lib/api';
import ReplicationSlots from './_components/ReplicationSlots';
import WalControl from './_components/WalControl';

export default function ReplicationPage() {
  const [selectedCluster, setSelectedCluster] = useState<string>('');

  const { data: clusters = [] } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => inventoryApi.getClusters().then((r) => r.data.clusters || []),
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">복제 관리</h1>
          <p className="text-gray-400 mt-1">클러스터 토폴로지 및 복제 상태 모니터링</p>
        </div>
        <select
          value={selectedCluster}
          onChange={(e) => setSelectedCluster(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="">클러스터 선택</option>
          {clusters.map((cluster: any) => (
            <option key={cluster.id} value={cluster.id}>
              {cluster.name}
            </option>
          ))}
        </select>
      </div>

      {selectedCluster ? (
        <ReplicationContent clusterId={selectedCluster} />
      ) : (
        <div className="glass-card p-12 text-center">
          <p className="text-gray-400">복제 상태를 조회할 클러스터를 선택하세요</p>
        </div>
      )}
    </div>
  );
}

function ReplicationContent({ clusterId }: { clusterId: string }) {
  const queryClient = useQueryClient();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  const { data: topology, isLoading: topologyLoading } = useQuery({
    queryKey: ['topology', clusterId],
    queryFn: () => replicationApi.getClusterTopology(clusterId).then((r) => r.data),
    refetchInterval: 10000,
  });

  const { data: failoverReadiness } = useQuery({
    queryKey: ['failover-readiness', clusterId],
    queryFn: () => failoverApi.checkReadiness(clusterId).then((r) => r.data),
    refetchInterval: 30000,
  });

  // Auto-select primary when topology loads
  useEffect(() => {
    if (topology?.primary && !selectedInstanceId) {
      setSelectedInstanceId(topology.primary.instance.id);
    }
  }, [topology, selectedInstanceId]);

  const { data: instanceStatus, isLoading: isStatusLoading } = useQuery({
    queryKey: ['replication-status', selectedInstanceId],
    queryFn: () =>
      selectedInstanceId ? replicationApi.getStatus(selectedInstanceId).then((r) => r.data) : null,
    enabled: !!selectedInstanceId,
    refetchInterval: 5000,
  });

  const switchoverMutation = useMutation({
    mutationFn: (newPrimaryId: string) =>
      failoverApi.initiateSwitchover(clusterId, newPrimaryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topology', clusterId] });
      alert('Switchover가 시작되었습니다');
    },
    onError: (error: any) => {
      alert(`Switchover 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  if (topologyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-postgres-500"></div>
      </div>
    );
  }

  const primary = topology?.primary;
  const standbys = topology?.standbys || [];

  return (
    <div className="space-y-6">
      {/* Cluster Info */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{topology?.cluster?.name}</h2>
            <p className="text-sm text-gray-400">{topology?.cluster?.environment}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 text-sm rounded ${
                failoverReadiness?.ready
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {failoverReadiness?.ready ? 'Failover 가능' : 'Failover 불가'}
            </span>
          </div>
        </div>
      </div>

      {/* Topology Visualization */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">클러스터 토폴로지</h3>
        <p className="text-sm text-gray-400 mb-6 text-center">
          인스턴스를 클릭하여 상세 정보와 관리 옵션을 확인하세요.
        </p>
        <div className="flex flex-col items-center">
          {/* Primary */}
          {primary && (
            <div className="mb-8">
              <InstanceCard
                instance={primary.instance}
                role="primary"
                healthy={primary.healthy}
                onClick={() => setSelectedInstanceId(primary.instance.id)}
                isSelected={selectedInstanceId === primary.instance.id}
              />
            </div>
          )}

          {/* Replication Lines */}
          {standbys.length > 0 && (
            <div className="w-px h-8 bg-postgres-500"></div>
          )}

          {/* Standbys */}
          <div className="flex gap-6 flex-wrap justify-center">
            {standbys.map((standby: any) => (
              <div key={standby.instance.id} className="flex flex-col items-center">
                <div className="w-px h-8 bg-gray-600"></div>
                <InstanceCard
                  instance={standby.instance}
                  role="standby"
                  healthy={standby.healthy}
                  lag={standby.replicationLag}
                  onSwitchover={() => {
                    if (confirm(`${standby.instance.name}을(를) Primary로 승격하시겠습니까?`)) {
                      switchoverMutation.mutate(standby.instance.id);
                    }
                  }}
                  canSwitchover={failoverReadiness?.ready}
                  onClick={() => setSelectedInstanceId(standby.instance.id)}
                  isSelected={selectedInstanceId === standby.instance.id}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Instance Details & Management */}
      {selectedInstanceId && instanceStatus && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
          <div className="flex items-center gap-3">
             <div className="h-8 w-1 bg-postgres-500 rounded-full"></div>
             <h2 className="text-xl font-bold text-white">
              {instanceStatus.instance.name} 상세 관리
            </h2>
          </div>
         
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <WalControl 
              instanceId={selectedInstanceId} 
              role={instanceStatus.role}
              walStats={instanceStatus.wal}
              recoveryInfo={instanceStatus.recovery}
            />
            {instanceStatus.role === 'primary' && (
               <ReplicationSlots 
                 instanceId={selectedInstanceId} 
                 slots={instanceStatus.replicationSlots} 
               />
            )}
          </div>
        </div>
      )}

      {/* Failover Candidates */}
      {failoverReadiness?.candidates && (
        <div className="glass-card p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Failover 후보</h3>
          <div className="space-y-2">
            {failoverReadiness.candidates.map((candidate: any) => (
              <div
                key={candidate.instance.id}
                className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      candidate.suitable ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  ></div>
                  <div>
                    <p className="text-white">{candidate.instance.name}</p>
                    <p className="text-sm text-gray-400">
                      점수: {candidate.score}/100
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {candidate.replicationLag && (
                    <p className="text-sm text-gray-400">
                      지연: {candidate.replicationLag.lagSeconds}s
                    </p>
                  )}
                  {candidate.issues.length > 0 && (
                    <p className="text-sm text-red-400">
                      {candidate.issues.length}개 이슈
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InstanceCard({
  instance,
  role,
  healthy,
  lag,
  onSwitchover,
  canSwitchover,
  onClick,
  isSelected,
}: {
  instance: any;
  role: 'primary' | 'standby';
  healthy: boolean;
  lag?: any;
  onSwitchover?: () => void;
  canSwitchover?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected
          ? 'border-postgres-400 ring-2 ring-postgres-500/50 scale-105'
          : role === 'primary'
          ? 'border-postgres-500 bg-postgres-500/10 hover:border-postgres-400'
          : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-3 h-3 rounded-full ${
            healthy ? 'bg-green-500' : 'bg-red-500'
          }`}
        ></div>
        <span
          className={`text-xs px-2 py-1 rounded ${
            role === 'primary'
              ? 'bg-postgres-500/20 text-postgres-400'
              : 'bg-gray-600/50 text-gray-300'
          }`}
        >
          {role.toUpperCase()}
        </span>
      </div>
      <h4 className="text-white font-medium">{instance.name}</h4>
      <p className="text-sm text-gray-400">
        {instance.host}:{instance.port}
      </p>
      {lag && (
        <div className="mt-2 text-sm">
          <span
            className={
              lag.lagSeconds > 60 ? 'text-red-400' : lag.lagSeconds > 10 ? 'text-yellow-400' : 'text-green-400'
            }
          >
            지연: {lag.lagSeconds}s / {Math.round(lag.lagBytes / 1024)}KB
          </span>
        </div>
      )}
      {role === 'standby' && onSwitchover && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSwitchover();
          }}
          disabled={!canSwitchover}
          className="mt-3 w-full px-3 py-1 text-sm bg-postgres-600 hover:bg-postgres-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded"
        >
          Switchover
        </button>
      )}
    </div>
  );
}
