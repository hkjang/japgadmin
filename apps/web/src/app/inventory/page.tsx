"use client";

import { useState, useEffect } from 'react';
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
  replicationRole?: string;
  clusterId?: string;
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null);
  const [showInstanceModal, setShowInstanceModal] = useState(false);
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null);

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
    onSuccess: (data, instanceId) => {
      alert(data.data.success ? '연결 성공!' : `연결 실패: ${data.data.error}`);
    },
    onError: (error: any) => {
      alert(`연결 테스트 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const deleteClusterMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.deleteCluster(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      alert('클러스터가 삭제되었습니다');
    },
    onError: (error: any) => {
      alert(`삭제 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.deleteInstance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      alert('인스턴스가 삭제되었습니다');
    },
    onError: (error: any) => {
      alert(`삭제 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'bg-green-500';
      case 'DEGRADED':
        return 'bg-yellow-500';
      case 'UNREACHABLE':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
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

      {/* Cluster Filter */}
      <div className="flex gap-2">
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
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedCluster === cluster.id
                ? 'bg-postgres-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {cluster.name}
          </button>
        ))}
      </div>

      {/* Clusters Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {clusters
          .filter((c: Cluster) => !selectedCluster || c.id === selectedCluster)
          .map((cluster: Cluster) => (
            <div key={cluster.id} className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{cluster.name}</h3>
                  <p className="text-sm text-gray-400">{cluster.description}</p>
                </div>
                <div className="flex items-center gap-2">
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
                    <div className="absolute right-0 mt-1 w-32 bg-gray-800 border border-gray-700 rounded shadow-lg hidden group-hover:block z-10">
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
                          if (confirm(`${cluster.name} 클러스터를 삭제하시겠습니까?`)) {
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

              {/* Instances in cluster */}
              <div className="space-y-2">
                {instances
                  .filter((i: Instance) => (i as any).clusterId === cluster.id)
                  .map((instance: Instance) => (
                    <div
                      key={instance.id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${getStatusColor(instance.status)}`}
                        ></div>
                        <div>
                          <p className="text-sm font-medium text-white">{instance.name}</p>
                          <p className="text-xs text-gray-500">
                            {instance.host}:{instance.port}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {instance.replicationRole && (
                          <span className="text-xs text-gray-400">
                            {instance.replicationRole}
                          </span>
                        )}
                        <button
                          onClick={() => testConnectionMutation.mutate(instance.id)}
                          disabled={testConnectionMutation.isPending}
                          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                        >
                          연결 테스트
                        </button>
                        <div className="relative group">
                          <button className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
                            ⋮
                          </button>
                          <div className="absolute right-0 mt-1 w-32 bg-gray-800 border border-gray-700 rounded shadow-lg hidden group-hover:block z-10">
                            <button
                              onClick={() => {
                                setEditingInstance(instance);
                                setShowInstanceModal(true);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  confirm(`${instance.name} 인스턴스를 삭제하시겠습니까?`)
                                ) {
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
                  ))}

                {instances.filter((i: Instance) => (i as any).clusterId === cluster.id)
                  .length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    등록된 인스턴스가 없습니다
                  </p>
                )}
              </div>
            </div>
          ))}
      </div>

      {clusters.length === 0 && (
        <div className="glass-card p-12 text-center">
          <p className="text-gray-400">등록된 클러스터가 없습니다</p>
          <button
            onClick={() => {
              setEditingCluster(null);
              setShowClusterModal(true);
            }}
            className="mt-4 px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg transition-colors"
          >
            첫 클러스터 추가하기
          </button>
        </div>
      )}

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
          onClose={() => setShowInstanceModal(false)}
        />
      )}
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
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">
          {initialData ? '클러스터 수정' : '클러스터 추가'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">이름</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">환경</label>
            <select
              value={formData.environment}
              onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              <option value="PRODUCTION">Production</option>
              <option value="STAGING">Staging</option>
              <option value="DEVELOPMENT">Development</option>
              <option value="TEST">Test</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg disabled:opacity-50"
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
  onClose,
}: {
  clusters: Cluster[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    clusterId: clusters[0]?.id || '',
    host: '',
    port: 5432,
    username: 'postgres',
    password: '',
    database: 'postgres',
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => inventoryApi.createInstance(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      onClose();
    },
    onError: (error: any) => {
      alert(`생성 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">인스턴스 추가</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">이름</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">클러스터</label>
            <select
              value={formData.clusterId}
              onChange={(e) => setFormData({ ...formData, clusterId: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            >
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">호스트</label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                placeholder="localhost"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">포트</label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">사용자명</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">비밀번호</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">데이터베이스</label>
            <input
              type="text"
              value={formData.database}
              onChange={(e) => setFormData({ ...formData, database: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg disabled:opacity-50"
            >
              {createMutation.isPending ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
