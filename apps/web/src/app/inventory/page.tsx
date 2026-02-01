"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api';

interface Cluster {
  id: string;
  name: string;
  environment: string;
  description?: string;
  instances: Instance[];
}

interface Instance {
  id: string;
  name: string;
  host: string;
  port: number;
  status: string;
  role?: string;
  replicationRole?: string;
  clusterId?: string;
  defaultDatabase?: string;
  username?: string;
  sslMode?: string;
  pgVersion?: string;
  lastSeenAt?: string;
  databases?: Database[];
}

interface Database {
  id: string;
  name: string;
  owner?: string;
  encoding?: string;
  sizeBytes?: number;
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null);
  const [showInstanceModal, setShowInstanceModal] = useState(false);
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: clusters = [], isLoading } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => inventoryApi.getClusters().then((r) => r.data.clusters || []),
  });

  const { data: instances = [] } = useQuery({
    queryKey: ['instances', selectedCluster],
    queryFn: () =>
      inventoryApi.getInstances(selectedCluster || undefined).then((r) => r.data.instances || []),
    enabled: true,
  });

  const testConnectionMutation = useMutation({
    mutationFn: (instanceId: string) => inventoryApi.testConnection(instanceId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      if (data.data.success) {
        // Toast 대신 간단한 알림
      }
    },
    onError: (error: any) => {
      alert(`연결 테스트 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const testAllConnectionsMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        instances.map((instance: Instance) => inventoryApi.testConnection(instance.id))
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
    },
  });

  const discoverDatabasesMutation = useMutation({
    mutationFn: (instanceId: string) => inventoryApi.discoverDatabases(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      alert('데이터베이스 탐색이 완료되었습니다.');
    },
    onError: (error: any) => {
      alert(`탐색 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const deleteClusterMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.deleteCluster(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      queryClient.invalidateQueries({ queryKey: ['instances'] });
    },
    onError: (error: any) => {
      alert(`삭제 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.deleteInstance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      setSelectedInstance(null);
    },
    onError: (error: any) => {
      alert(`삭제 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ONLINE':
      case 'HEALTHY':
        return 'bg-emerald-500';
      case 'DEGRADED':
        return 'bg-yellow-500';
      case 'OFFLINE':
      case 'UNREACHABLE':
        return 'bg-red-500';
      case 'MAINTENANCE':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ONLINE':
      case 'HEALTHY':
        return '온라인';
      case 'DEGRADED':
        return '성능 저하';
      case 'OFFLINE':
      case 'UNREACHABLE':
        return '오프라인';
      case 'MAINTENANCE':
        return '유지보수';
      default:
        return '알 수 없음';
    }
  };

  const getEnvironmentBadge = (env: string) => {
    const colors: Record<string, string> = {
      PRODUCTION: 'bg-red-500/20 text-red-400 border-red-500/50',
      STAGING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      DEVELOPMENT: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      TEST: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
    };
    return colors[env] || colors.DEVELOPMENT;
  };

  const getRoleBadge = (role: string) => {
    switch (role?.toUpperCase()) {
      case 'PRIMARY':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 'STANDBY':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'READ_REPLICA':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  // 통계 계산
  const stats = {
    totalClusters: clusters.length,
    totalInstances: instances.length,
    onlineInstances: instances.filter((i: Instance) =>
      i.status?.toUpperCase() === 'ONLINE' || i.status?.toUpperCase() === 'HEALTHY'
    ).length,
    offlineInstances: instances.filter((i: Instance) =>
      i.status?.toUpperCase() === 'OFFLINE' || i.status?.toUpperCase() === 'UNREACHABLE'
    ).length,
    productionClusters: clusters.filter((c: Cluster) => c.environment === 'PRODUCTION').length,
  };

  // 필터링된 클러스터
  const filteredClusters = clusters.filter((c: Cluster) => {
    const matchesCluster = !selectedCluster || c.id === selectedCluster;
    const matchesSearch = !searchTerm ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instances.some((i: Instance) =>
        (i as any).clusterId === c.id &&
        (i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         i.host.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    return matchesCluster && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-postgres-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">인벤토리</h1>
          <p className="text-gray-400 mt-1">클러스터 및 인스턴스 관리</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => testAllConnectionsMutation.mutate()}
            disabled={testAllConnectionsMutation.isPending || instances.length === 0}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {testAllConnectionsMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                테스트 중...
              </>
            ) : (
              <>🔄 전체 연결 테스트</>
            )}
          </button>
          <button
            onClick={() => {
              setEditingCluster(null);
              setShowClusterModal(true);
            }}
            className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg transition-colors"
          >
            + 클러스터 추가
          </button>
          <button
            onClick={() => {
              setEditingInstance(null);
              setShowInstanceModal(true);
            }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            + 인스턴스 추가
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-white">{stats.totalClusters}</div>
          <div className="text-sm text-gray-400">전체 클러스터</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-white">{stats.totalInstances}</div>
          <div className="text-sm text-gray-400">전체 인스턴스</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-emerald-400">{stats.onlineInstances}</div>
          <div className="text-sm text-gray-400">온라인</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-red-400">{stats.offlineInstances}</div>
          <div className="text-sm text-gray-400">오프라인</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-yellow-400">{stats.productionClusters}</div>
          <div className="text-sm text-gray-400">운영 환경</div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="클러스터, 인스턴스, 호스트 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-dark-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-postgres-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCluster(null)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              !selectedCluster
                ? 'bg-postgres-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            전체
          </button>
          {clusters.map((cluster: Cluster) => (
            <button
              key={cluster.id}
              onClick={() => setSelectedCluster(cluster.id)}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                selectedCluster === cluster.id
                  ? 'bg-postgres-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${
                cluster.environment === 'PRODUCTION' ? 'bg-red-400' :
                cluster.environment === 'STAGING' ? 'bg-yellow-400' : 'bg-blue-400'
              }`} />
              {cluster.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Clusters Grid */}
        <div className={`${selectedInstance ? 'w-2/3' : 'w-full'} transition-all`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredClusters.map((cluster: Cluster) => (
              <div key={cluster.id} className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate">{cluster.name}</h3>
                    <p className="text-sm text-gray-400 truncate">{cluster.description || '설명 없음'}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span
                      className={`px-2 py-1 text-xs rounded border ${getEnvironmentBadge(
                        cluster.environment
                      )}`}
                    >
                      {cluster.environment}
                    </span>
                    <div className="relative group">
                      <button className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
                        ⋮
                      </button>
                      <div className="absolute right-0 top-full pt-1 w-32 hidden group-hover:block z-10">
                        <div className="bg-gray-800 border border-gray-700 rounded shadow-lg overflow-hidden">
                          <button
                            onClick={() => {
                              setEditingCluster(cluster);
                              setShowClusterModal(true);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`${cluster.name} 클러스터를 삭제하시겠습니까?\n포함된 모든 인스턴스도 함께 삭제됩니다.`)) {
                                deleteClusterMutation.mutate(cluster.id);
                              }
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Instances in cluster */}
                <div className="space-y-2">
                  {instances
                    .filter((i: Instance) => (i as any).clusterId === cluster.id)
                    .map((instance: Instance) => (
                      <div
                        key={instance.id}
                        onClick={() => setSelectedInstance(selectedInstance?.id === instance.id ? null : instance)}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                          selectedInstance?.id === instance.id
                            ? 'bg-postgres-600/20 border border-postgres-500/50'
                            : 'bg-gray-800/50 hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="relative">
                            <div
                              className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`}
                            />
                            {testConnectionMutation.isPending &&
                             testConnectionMutation.variables === instance.id && (
                              <div className="absolute inset-0 w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white truncate">{instance.name}</p>
                              {instance.pgVersion && (
                                <span className="text-xs text-gray-500">v{instance.pgVersion}</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              {instance.host}:{instance.port}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(instance.role || instance.replicationRole) && (
                            <span className={`px-2 py-0.5 text-xs rounded border ${getRoleBadge(instance.role || instance.replicationRole || '')}`}>
                              {instance.role || instance.replicationRole}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              testConnectionMutation.mutate(instance.id);
                            }}
                            disabled={testConnectionMutation.isPending}
                            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                          >
                            테스트
                          </button>
                          <div className="relative group">
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                            >
                              ⋮
                            </button>
                            <div className="absolute right-0 top-full pt-1 w-36 hidden group-hover:block z-10">
                              <div className="bg-gray-800 border border-gray-700 rounded shadow-lg overflow-hidden">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingInstance(instance);
                                    setShowInstanceModal(true);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                                >
                                  수정
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    discoverDatabasesMutation.mutate(instance.id);
                                  }}
                                  disabled={discoverDatabasesMutation.isPending}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50"
                                >
                                  DB 탐색
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`${instance.name} 인스턴스를 삭제하시겠습니까?`)) {
                                      deleteInstanceMutation.mutate(instance.id);
                                    }
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300"
                                >
                                  삭제
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  {instances.filter((i: Instance) => (i as any).clusterId === cluster.id).length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      등록된 인스턴스가 없습니다
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredClusters.length === 0 && clusters.length > 0 && (
            <div className="glass-card p-8 text-center">
              <p className="text-gray-400">검색 결과가 없습니다</p>
            </div>
          )}

          {clusters.length === 0 && (
            <div className="glass-card p-12 text-center">
              <div className="text-5xl mb-4">🗄️</div>
              <p className="text-gray-400 mb-4">등록된 클러스터가 없습니다</p>
              <button
                onClick={() => {
                  setEditingCluster(null);
                  setShowClusterModal(true);
                }}
                className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg transition-colors"
              >
                첫 클러스터 추가하기
              </button>
            </div>
          )}
        </div>

        {/* Instance Detail Panel */}
        {selectedInstance && (
          <InstanceDetailPanel
            instance={selectedInstance}
            onClose={() => setSelectedInstance(null)}
            onEdit={() => {
              setEditingInstance(selectedInstance);
              setShowInstanceModal(true);
            }}
            onDelete={() => {
              if (confirm(`${selectedInstance.name} 인스턴스를 삭제하시겠습니까?`)) {
                deleteInstanceMutation.mutate(selectedInstance.id);
              }
            }}
            onDiscoverDatabases={() => discoverDatabasesMutation.mutate(selectedInstance.id)}
            isDiscovering={discoverDatabasesMutation.isPending}
          />
        )}
      </div>

      {/* Cluster Modal */}
      {showClusterModal && (
        <ClusterModal
          initialData={editingCluster}
          onClose={() => {
            setShowClusterModal(false);
            setEditingCluster(null);
          }}
        />
      )}

      {/* Instance Modal */}
      {showInstanceModal && (
        <InstanceModal
          clusters={clusters}
          initialData={editingInstance}
          onClose={() => {
            setShowInstanceModal(false);
            setEditingInstance(null);
          }}
        />
      )}
    </div>
  );
}

// Instance Detail Panel Component
function InstanceDetailPanel({
  instance,
  onClose,
  onEdit,
  onDelete,
  onDiscoverDatabases,
  isDiscovering,
}: {
  instance: Instance;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDiscoverDatabases: () => void;
  isDiscovering: boolean;
}) {
  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ONLINE':
      case 'HEALTHY':
        return 'text-emerald-400';
      case 'DEGRADED':
        return 'text-yellow-400';
      case 'OFFLINE':
      case 'UNREACHABLE':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ONLINE':
      case 'HEALTHY':
        return '온라인';
      case 'DEGRADED':
        return '성능 저하';
      case 'OFFLINE':
      case 'UNREACHABLE':
        return '오프라인';
      case 'MAINTENANCE':
        return '유지보수';
      default:
        return '알 수 없음';
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="w-1/3 glass-card p-5 h-fit sticky top-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">인스턴스 상세</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Instance Info */}
      <div className="space-y-4">
        <div>
          <h4 className="text-xl font-bold text-white">{instance.name}</h4>
          <p className="text-sm text-gray-400">{instance.host}:{instance.port}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-800/50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">상태</div>
            <div className={`font-medium ${getStatusColor(instance.status)}`}>
              {getStatusText(instance.status)}
            </div>
          </div>
          <div className="p-3 bg-gray-800/50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">PostgreSQL</div>
            <div className="font-medium text-white">
              {instance.pgVersion || 'N/A'}
            </div>
          </div>
          <div className="p-3 bg-gray-800/50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">역할</div>
            <div className="font-medium text-white">
              {instance.role || instance.replicationRole || 'PRIMARY'}
            </div>
          </div>
          <div className="p-3 bg-gray-800/50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">SSL</div>
            <div className="font-medium text-white">
              {instance.sslMode || 'PREFER'}
            </div>
          </div>
        </div>

        {instance.lastSeenAt && (
          <div className="text-xs text-gray-500">
            마지막 연결: {new Date(instance.lastSeenAt).toLocaleString('ko-KR')}
          </div>
        )}

        {/* Databases */}
        <div className="pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white">데이터베이스</h4>
            <button
              onClick={onDiscoverDatabases}
              disabled={isDiscovering}
              className="text-xs text-postgres-400 hover:text-postgres-300 disabled:opacity-50"
            >
              {isDiscovering ? '탐색 중...' : '🔍 탐색'}
            </button>
          </div>

          {instance.databases && instance.databases.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              {instance.databases.map((db: Database) => (
                <div
                  key={db.id}
                  className="p-2 bg-gray-800/50 rounded flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-postgres-400">🗃️</span>
                    <span className="text-sm text-white">{db.name}</span>
                  </div>
                  {db.sizeBytes && (
                    <span className="text-xs text-gray-500">
                      {formatBytes(db.sizeBytes)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              데이터베이스 정보가 없습니다
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-gray-700 flex gap-2">
          <button
            onClick={onEdit}
            className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
          >
            수정
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function ClusterModal({
  initialData,
  onClose,
}: {
  initialData?: Cluster | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    environment: initialData?.environment || 'DEVELOPMENT',
    description: initialData?.description || '',
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      initialData
        ? inventoryApi.updateCluster(initialData.id, data)
        : inventoryApi.createCluster(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      onClose();
    },
    onError: (error: any) => {
      alert(`저장 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">
          {initialData ? '클러스터 수정' : '클러스터 추가'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">이름 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-postgres-500"
              placeholder="production-cluster"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">환경</label>
            <select
              value={formData.environment}
              onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-postgres-500"
            >
              <option value="PRODUCTION">🔴 Production (운영)</option>
              <option value="STAGING">🟡 Staging (스테이징)</option>
              <option value="DEVELOPMENT">🔵 Development (개발)</option>
              <option value="TEST">⚪ Test (테스트)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-postgres-500"
              rows={3}
              placeholder="클러스터에 대한 설명을 입력하세요"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InstanceModal({
  clusters,
  initialData,
  onClose,
}: {
  clusters: Cluster[];
  initialData?: Instance | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    clusterId: initialData?.clusterId || clusters[0]?.id || '',
    host: initialData?.host || '',
    port: initialData?.port || 5432,
    username: initialData?.username || 'postgres',
    password: '',
    database: initialData?.defaultDatabase || 'postgres',
    sslMode: initialData?.sslMode || 'PREFER',
    role: (initialData as any)?.role || 'PRIMARY',
  });
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      initialData
        ? inventoryApi.updateInstance(initialData.id, data)
        : inventoryApi.createInstance(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      onClose();
    },
    onError: (error: any) => {
      alert(`${initialData ? '수정' : '생성'} 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = { ...formData };
    if (initialData && !submitData.password) {
      delete (submitData as any).password;
    }
    mutation.mutate(submitData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">
          {initialData ? '인스턴스 수정' : '인스턴스 추가'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">이름 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-postgres-500"
                placeholder="primary-db-01"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">클러스터 *</label>
              <select
                value={formData.clusterId}
                onChange={(e) => setFormData({ ...formData, clusterId: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-postgres-500"
                required
              >
                {clusters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.environment})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">역할</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-postgres-500"
              >
                <option value="PRIMARY">Primary (주)</option>
                <option value="STANDBY">Standby (대기)</option>
                <option value="READ_REPLICA">Read Replica (읽기 전용)</option>
              </select>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">연결 정보</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">호스트 *</label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-postgres-500"
                  placeholder="db.example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">포트 *</label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-postgres-500"
                  required
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">인증 정보</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">사용자명 *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-postgres-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  비밀번호 {!initialData && '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-postgres-500 pr-10"
                    required={!initialData}
                    placeholder={initialData ? '변경시에만 입력' : ''}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">기본 데이터베이스</label>
              <input
                type="text"
                value={formData.database}
                onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-postgres-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">SSL 모드</label>
              <select
                value={formData.sslMode}
                onChange={(e) => setFormData({ ...formData, sslMode: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-postgres-500"
              >
                <option value="DISABLE">Disable</option>
                <option value="ALLOW">Allow</option>
                <option value="PREFER">Prefer (권장)</option>
                <option value="REQUIRE">Require</option>
                <option value="VERIFY_CA">Verify CA</option>
                <option value="VERIFY_FULL">Verify Full</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
