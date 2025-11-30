'use client';

import { useEffect, useState } from 'react';
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

export default function MonitoringPage() {
  const { t } = useTranslation();
  const [activity, setActivity] = useState<any[]>([]);
  const [waitEvents, setWaitEvents] = useState<any[]>([]);
  const [tableSizes, setTableSizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [activityRes, waitRes, sizeRes] = await Promise.all([
          monitoringApi.getActivity(),
          monitoringApi.getWaitEvents(),
          monitoringApi.getTableSizes(),
        ]);

        setActivity(activityRes.data.activity || []);
        setWaitEvents(waitRes.data.waitEvents || []);
        setTableSizes(sizeRes.data.tableSizes || []);
      } catch (error) {
        console.error('Failed to fetch monitoring data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-gray-400 text-lg">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <header className="space-y-2">
        <h2 className="text-3xl font-bold text-white">{t('monitoringPage.title')}</h2>
        <p className="text-gray-400">{t('monitoringPage.subtitle')}</p>
      </header>

      {/* Real-time Performance Chart */}
      <RealtimePerformanceChart />

      {/* Connection Pool and Disk Usage Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConnectionPoolMonitor />
        <DiskUsageMonitor />
      </div>

      {/* Replication Monitoring */}
      <ReplicationMonitor />

      {/* Current Activity */}
      <div className="glass-card overflow-hidden">
        <div className="glass-header p-6">
          <h3 className="text-xl font-semibold text-white">{t('monitoringPage.currentActivity')}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {activity.length} {t('monitoringPage.activeSessions')}
          </p>
        </div>
        <ActivityTable data={activity} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('monitoringPage.waitEvents')}</h3>
          <WaitEventChart data={waitEvents} />
        </div>
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('monitoringPage.tableSize')}</h3>
          <TableSizeChart data={tableSizes} />
        </div>
      </div>

      {/* Locks Monitoring */}
      <LocksMonitor />
    </div>
  );
}
