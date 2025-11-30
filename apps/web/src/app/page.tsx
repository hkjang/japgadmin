'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { monitoringApi } from '@/lib/api';
import TxidWarning from '@/components/Dashboard/TxidWarning';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, BarController } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, BarController);

export default function Dashboard() {
  const { t } = useTranslation();
  const [dbStats, setDbStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await monitoringApi.getDatabaseStats();
        setDbStats(res.data);
      } catch (error) {
        console.error('Failed to fetch stats', error);
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

  const stats = [
    {
      label: t('activeConnections'),
      value: dbStats?.numbackends || '0',
      icon: '🔌',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      label: t('cacheHitRatio'),
      value: dbStats?.blks_hit && dbStats?.blks_read
        ? `${((parseFloat(dbStats.blks_hit) / (parseFloat(dbStats.blks_hit) + parseFloat(dbStats.blks_read))) * 100).toFixed(1)}%`
        : 'N/A',
      icon: '⚡',
      color: 'from-emerald-500 to-green-500',
    },
    {
      label: t('transactions'),
      value: dbStats?.xact_commit || '0',
      icon: '📊',
      color: 'from-purple-500 to-pink-500',
    },
    {
      label: t('deadlocks'),
      value: dbStats?.deadlocks || '0',
      icon: '⚠️',
      color: 'from-orange-500 to-red-500',
    },
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <h2 className="text-3xl font-bold text-white">{t('dashboard')}</h2>
        <p className="text-gray-400">{t('systemOnline')}</p>
      </header>

      {/* Transaction ID Wraparound Warning */}
      <TxidWarning />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="stat-card"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">{stat.icon}</span>
              <div className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                {stat.value}
              </div>
            </div>
            <div className="text-sm text-gray-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Database Activity */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">{t('databaseActivity')}</h3>
          <span className="text-xs text-gray-500">{t('lastUpdated')}: {new Date().toLocaleTimeString('ko-KR')}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <div className="text-sm text-gray-400">{t('blocksRead')}</div>
            <div className="text-2xl font-semibold text-postgres-400">{dbStats?.blks_read || '0'}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-gray-400">{t('blocksHit')}</div>
            <div className="text-2xl font-semibold text-emerald-400">{dbStats?.blks_hit || '0'}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-gray-400">{t('tuplesReturned')}</div>
            <div className="text-2xl font-semibold text-purple-400">{dbStats?.tup_returned || '0'}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-gray-400">{t('tuplesFetched')}</div>
            <div className="text-2xl font-semibold text-pink-400">{dbStats?.tup_fetched || '0'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
