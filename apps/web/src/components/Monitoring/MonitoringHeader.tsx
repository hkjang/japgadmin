'use client';

import { useEffect, useState } from 'react';
import { monitoringApi } from '@/lib/api';

interface MonitoringStats {
  activeSessions: number;
  totalConnections: number;
  maxConnections: number;
  cacheHitRatio: number;
  deadlocks: number;
  waitingLocks: number;
}

interface MonitoringHeaderProps {
  refreshInterval: number;
  onRefreshIntervalChange: (interval: number) => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (enabled: boolean) => void;
  lastUpdated: Date | null;
}

export default function MonitoringHeader({
  refreshInterval,
  onRefreshIntervalChange,
  autoRefresh,
  onAutoRefreshChange,
  lastUpdated,
}: MonitoringHeaderProps) {
  const [stats, setStats] = useState<MonitoringStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [dbRes, connRes, locksRes] = await Promise.all([
          monitoringApi.getDatabaseStats(),
          monitoringApi.getConnectionStats(),
          monitoringApi.getLocks(),
        ]);

        const dbData = dbRes.data.data || dbRes.data;
        const connData = connRes.data.connections;
        const locksData = locksRes.data.locks || [];

        const blksHit = parseFloat(dbData.blks_hit || '0');
        const blksRead = parseFloat(dbData.blks_read || '0');
        const cacheHitRatio = blksHit + blksRead > 0
          ? (blksHit / (blksHit + blksRead)) * 100
          : 0;

        setStats({
          activeSessions: parseInt(connData?.active_connections || '0'),
          totalConnections: parseInt(connData?.total_connections || '0'),
          maxConnections: parseInt(connData?.max_connections || '100'),
          cacheHitRatio,
          deadlocks: parseInt(dbData.deadlocks || '0'),
          waitingLocks: locksData.filter((l: any) => !l.granted).length,
        });
      } catch (error) {
        console.error('Failed to fetch monitoring stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const statItems = stats ? [
    {
      label: '활성 세션',
      value: stats.activeSessions,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: '연결 사용률',
      value: `${((stats.totalConnections / stats.maxConnections) * 100).toFixed(0)}%`,
      color: stats.totalConnections / stats.maxConnections > 0.8 ? 'text-red-400' : 'text-emerald-400',
      bgColor: stats.totalConnections / stats.maxConnections > 0.8 ? 'bg-red-500/10' : 'bg-emerald-500/10',
    },
    {
      label: '캐시 적중률',
      value: `${stats.cacheHitRatio.toFixed(1)}%`,
      color: stats.cacheHitRatio > 95 ? 'text-emerald-400' : stats.cacheHitRatio > 80 ? 'text-yellow-400' : 'text-red-400',
      bgColor: stats.cacheHitRatio > 95 ? 'bg-emerald-500/10' : stats.cacheHitRatio > 80 ? 'bg-yellow-500/10' : 'bg-red-500/10',
    },
    {
      label: '대기 Lock',
      value: stats.waitingLocks,
      color: stats.waitingLocks > 0 ? 'text-yellow-400' : 'text-gray-400',
      bgColor: stats.waitingLocks > 0 ? 'bg-yellow-500/10' : 'bg-gray-500/10',
    },
    {
      label: '데드락',
      value: stats.deadlocks,
      color: stats.deadlocks > 0 ? 'text-red-400' : 'text-gray-400',
      bgColor: stats.deadlocks > 0 ? 'bg-red-500/10' : 'bg-gray-500/10',
    },
  ] : [];

  return (
    <div className="space-y-4">
      {/* Title and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">실시간 모니터링</h2>
          <p className="text-gray-400 mt-1">데이터베이스 활동 및 성능 메트릭</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Auto Refresh Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAutoRefreshChange(!autoRefresh)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoRefresh ? 'bg-postgres-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-400">자동 새로고침</span>
          </div>

          {/* Refresh Interval Select */}
          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => onRefreshIntervalChange(parseInt(e.target.value))}
              className="px-3 py-1.5 bg-dark-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-postgres-500"
            >
              <option value={3000}>3초</option>
              <option value={5000}>5초</option>
              <option value={10000}>10초</option>
              <option value={30000}>30초</option>
              <option value={60000}>1분</option>
            </select>
          )}

          {/* Last Updated */}
          {lastUpdated && (
            <div className="text-xs text-gray-500">
              마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Bar */}
      {stats && (
        <div className="flex flex-wrap gap-3">
          {statItems.map((item, index) => (
            <div
              key={index}
              className={`px-4 py-2 rounded-lg ${item.bgColor} flex items-center gap-2`}
            >
              <span className="text-sm text-gray-400">{item.label}:</span>
              <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
