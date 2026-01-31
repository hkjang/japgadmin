'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupApi, inventoryApi } from '@/lib/api';

export default function BackupPage() {
  const [activeTab, setActiveTab] = useState<'backups' | 'configs' | 'stats'>('backups');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">백업 관리</h1>
        <p className="text-gray-400 mt-1">백업 설정 및 복구 지점 관리</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('backups')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'backups'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          백업 목록
        </button>
        <button
          onClick={() => setActiveTab('configs')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'configs'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          백업 설정
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'stats'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          통계
        </button>
      </div>

      {activeTab === 'backups' && <BackupsTab />}
      {activeTab === 'configs' && <ConfigsTab />}
      {activeTab === 'stats' && <StatsTab />}
    </div>
  );
}

function BackupsTab() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: () => backupApi.getBackups({}).then((r) => r.data),
  });

  const deleteBackupMutation = useMutation({
    mutationFn: (id: string) => backupApi.deleteBackup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      alert('백업이 삭제되었습니다');
    },
    onError: (error: any) => {
      alert(`삭제 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const backups = data?.backups || [];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      COMPLETED: 'bg-green-500/20 text-green-400',
      IN_PROGRESS: 'bg-blue-500/20 text-blue-400',
      FAILED: 'bg-red-500/20 text-red-400',
      EXPIRED: 'bg-gray-500/20 text-gray-400',
    };
    return styles[status] || styles.EXPIRED;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-postgres-500"></div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-800/50">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">인스턴스</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">유형</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">상태</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">크기</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">시작 시간</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">완료 시간</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">작업</th>
          </tr>
        </thead>
        <tbody>
          {backups.map((backup: any) => (
            <tr key={backup.id} className="border-t border-gray-800">
              <td className="px-4 py-3 text-white">
                {backup.config?.instance?.name || '-'}
              </td>
              <td className="px-4 py-3 text-gray-300">{backup.type}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 text-xs rounded ${getStatusBadge(backup.status)}`}>
                  {backup.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-400">
                {backup.sizeBytes ? formatBytes(Number(backup.sizeBytes)) : '-'}
              </td>
              <td className="px-4 py-3 text-gray-400 text-sm">
                {new Date(backup.startedAt).toLocaleString('ko-KR')}
              </td>
              <td className="px-4 py-3 text-gray-400 text-sm">
                {backup.completedAt
                  ? new Date(backup.completedAt).toLocaleString('ko-KR')
                  : '-'}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => {
                    if (confirm('이 백업을 삭제하시겠습니까?')) {
                      deleteBackupMutation.mutate(backup.id);
                    }
                  }}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
          {backups.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                백업이 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ConfigsTab() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any | null>(null);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['backup-configs'],
    queryFn: () => backupApi.getConfigs().then((r) => r.data),
  });

  const createBackupMutation = useMutation({
    mutationFn: (data: any) => backupApi.createBackup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      alert('백업이 시작되었습니다');
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: (id: string) => backupApi.deleteConfig(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-configs'] });
      alert('설정이 삭제되었습니다');
    },
    onError: (error: any) => {
      alert(`삭제 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-postgres-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditingConfig(null);
            setShowModal(true);
          }}
          className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg"
        >
          + 백업 설정 추가
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {configs.map((config: any) => (
          <div key={config.id} className="glass-card p-4 relative group">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-white font-medium">{config.instance?.name}</h3>
                <p className="text-sm text-gray-400">{config.provider}</p>
              </div>
              <span
                className={`px-2 py-1 text-xs rounded ${
                  config.enabled
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                {config.enabled ? '활성' : '비활성'}
              </span>
            </div>
            
            {/* Action Menu Overlap */}
            <div className="absolute top-4 right-14 hidden group-hover:flex gap-1">
                 <button 
                  onClick={() => {
                      setEditingConfig(config);
                      setShowModal(true);
                  }}
                  className="p-1 px-2 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
                 >
                    수정
                 </button>
                 <button
                  onClick={() => {
                      if(confirm('백업 설정을 삭제하시겠습니까?')) {
                          deleteConfigMutation.mutate(config.id);
                      }
                  }}
                  className="p-1 px-2 text-xs bg-red-900/50 hover:bg-red-900/80 text-red-200 rounded"
                 >
                    삭제
                 </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">전체 백업</span>
                <span className="text-gray-300">{config.fullBackupCron}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">보관 기간</span>
                <span className="text-gray-300">{config.retentionDays}일</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">백업 수</span>
                <span className="text-gray-300">{config._count?.backups || 0}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() =>
                  createBackupMutation.mutate({ configId: config.id, type: 'FULL' })
                }
                disabled={createBackupMutation.isPending}
                className="flex-1 px-3 py-2 bg-postgres-600 hover:bg-postgres-700 text-white text-sm rounded"
              >
                지금 백업
              </button>
            </div>
          </div>
        ))}
        {configs.length === 0 && (
          <div className="col-span-full glass-card p-12 text-center">
            <p className="text-gray-400">백업 설정이 없습니다</p>
          </div>
        )}
      </div>

      {showModal && (
        <BackupConfigModal
          initialData={editingConfig}
          onClose={() => {
            setShowModal(false);
            setEditingConfig(null);
          }}
        />
      )}
    </div>
  );
}

function BackupConfigModal({
  initialData,
  onClose,
}: {
  initialData?: any;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: instances = [] } = useQuery({
    queryKey: ['instances'],
    queryFn: () => inventoryApi.getInstances().then((r) => r.data.instances || []),
  });

  const [formData, setFormData] = useState({
    instanceId: initialData?.instanceId || '',
    provider: initialData?.provider || 'LOCAL',
    fullBackupCron: initialData?.fullBackupCron || '0 2 * * 0',
    retentionDays: initialData?.retentionDays || 30,
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      initialData
        ? backupApi.updateConfig(initialData.id, data)
        : backupApi.createConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-configs'] });
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
          {initialData ? '백업 설정 수정' : '백업 설정 추가'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">인스턴스</label>
            <select
              value={formData.instanceId}
              onChange={(e) => setFormData({ ...formData, instanceId: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
              disabled={!!initialData} // Usually can't change target instance on edit
            >
              <option value="">선택</option>
              {instances.map((instance: any) => (
                <option key={instance.id} value={instance.id}>
                  {instance.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">저장소</label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              <option value="LOCAL">로컬 디스크</option>
              <option value="S3">Amazon S3</option>
              <option value="GCS">Google Cloud Storage</option>
              <option value="AZURE">Azure Blob Storage</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              전체 백업 스케줄 (Cron)
            </label>
            <input
              type="text"
              value={formData.fullBackupCron}
              onChange={(e) => setFormData({ ...formData, fullBackupCron: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              placeholder="0 2 * * 0"
            />
            <p className="text-xs text-gray-500 mt-1">예: 0 2 * * 0 (매주 일요일 02:00)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">보관 기간 (일)</label>
            <input
              type="number"
              value={formData.retentionDays}
              onChange={(e) =>
                setFormData({ ...formData, retentionDays: parseInt(e.target.value) })
              }
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              min={1}
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

function StatsTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['backup-stats'],
    queryFn: () => backupApi.getStatistics().then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-postgres-500"></div>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="glass-card p-4">
        <p className="text-sm text-gray-400">총 백업</p>
        <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
      </div>
      <div className="glass-card p-4">
        <p className="text-sm text-gray-400">성공</p>
        <p className="text-2xl font-bold text-green-400">{stats?.completed || 0}</p>
      </div>
      <div className="glass-card p-4">
        <p className="text-sm text-gray-400">실패</p>
        <p className="text-2xl font-bold text-red-400">{stats?.failed || 0}</p>
      </div>
      <div className="glass-card p-4">
        <p className="text-sm text-gray-400">성공률</p>
        <p className="text-2xl font-bold text-white">{stats?.successRate || 0}%</p>
      </div>
      <div className="glass-card p-4 md:col-span-2">
        <p className="text-sm text-gray-400 mb-2">최근 7일</p>
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-gray-500">백업 수</p>
            <p className="text-xl font-bold text-white">{stats?.last7Days?.count || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">총 크기</p>
            <p className="text-xl font-bold text-white">
              {formatBytes(stats?.last7Days?.totalSizeBytes || 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">평균 시간</p>
            <p className="text-xl font-bold text-white">
              {Math.round((stats?.last7Days?.avgDurationMs || 0) / 1000)}s
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
