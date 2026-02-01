'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { monitoringApi } from '@/lib/api';
import ActivityTable from '@/components/Monitoring/ActivityTable';
import WaitEventChart from '@/components/Monitoring/WaitEventChart';
import TableSizeChart from '@/components/Monitoring/TableSizeChart';
import LocksMonitor from '@/components/Monitoring/LocksMonitor';
import RealtimePerformanceChart from '@/components/Monitoring/RealtimePerformanceChart';
import ConnectionPoolMonitor from '@/components/Monitoring/ConnectionPoolMonitor';
import DiskUsageMonitor from '@/components/Monitoring/DiskUsageMonitor';
import ReplicationMonitor from '@/components/Monitoring/ReplicationMonitor';
import MonitoringHeader from '@/components/Monitoring/MonitoringHeader';
import BgWriterStats from '@/components/Monitoring/BgWriterStats';

type TabType = 'overview' | 'sessions' | 'storage' | 'replication';

export default function MonitoringPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [activity, setActivity] = useState<any[]>([]);
  const [waitEvents, setWaitEvents] = useState<any[]>([]);
  const [tableSizes, setTableSizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  const fetchData = useCallback(async () => {
    try {
      const [activityRes, waitRes, sizeRes] = await Promise.all([
        monitoringApi.getActivity(),
        monitoringApi.getWaitEvents(),
        monitoringApi.getTableSizes(),
      ]);

      setActivity(activityRes.data.activity || []);
      setWaitEvents(waitRes.data.waitEvents || []);
      setTableSizes(sizeRes.data.tableSizes || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch monitoring data', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh, refreshInterval]);

  const tabs = [
    { id: 'overview' as const, label: '개요', icon: '📊' },
    { id: 'sessions' as const, label: '세션', icon: '👥' },
    { id: 'storage' as const, label: '스토리지', icon: '💾' },
    { id: 'replication' as const, label: '리플리케이션', icon: '🔄' },
  ];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-postgres-500 mx-auto mb-4" />
          <div className="text-gray-400 text-lg">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header with Stats */}
      <MonitoringHeader
        refreshInterval={refreshInterval}
        onRefreshIntervalChange={setRefreshInterval}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
        lastUpdated={lastUpdated}
      />

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-dark-800/50 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-postgres-600 text-white shadow-lg shadow-postgres-600/30'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Real-time Performance Chart */}
            <RealtimePerformanceChart />

            {/* Connection Pool and Disk Usage Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConnectionPoolMonitor />
              <BgWriterStats />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">대기 이벤트</h3>
                <WaitEventChart data={waitEvents} />
              </div>
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">테이블 크기 (Top 10)</h3>
                <TableSizeChart data={tableSizes} />
              </div>
            </div>

            {/* Locks Monitoring */}
            <LocksMonitor />
          </>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <>
            {/* Current Activity */}
            <div className="glass-card overflow-hidden">
              <div className="glass-header p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">현재 활동</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {activity.length}개 세션 활성
                  </p>
                </div>
              </div>
              <ActivityTable data={activity} onRefresh={fetchData} />
            </div>

            {/* Locks Monitoring */}
            <LocksMonitor />

            {/* Wait Events Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">대기 이벤트 분포</h3>
                <WaitEventChart data={waitEvents} />
              </div>
              <ConnectionPoolMonitor />
            </div>
          </>
        )}

        {/* Storage Tab */}
        {activeTab === 'storage' && (
          <>
            {/* Disk Usage */}
            <DiskUsageMonitor />

            {/* Table Sizes and BgWriter */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">테이블 크기 (Top 10)</h3>
                <TableSizeChart data={tableSizes} />
              </div>
              <BgWriterStats />
            </div>
          </>
        )}

        {/* Replication Tab */}
        {activeTab === 'replication' && (
          <>
            {/* Replication Monitoring */}
            <ReplicationMonitor />

            {/* Connection Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConnectionPoolMonitor />
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">대기 이벤트</h3>
                <WaitEventChart data={waitEvents} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
