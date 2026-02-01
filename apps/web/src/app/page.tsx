'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { monitoringApi } from '@/lib/api';
import TxidWarning from '@/components/Dashboard/TxidWarning';
import SystemHealthCard from '@/components/Dashboard/SystemHealthCard';
import QuickActions from '@/components/Dashboard/QuickActions';
import RecentAlerts from '@/components/Dashboard/RecentAlerts';
import MetricCardWithSparkline from '@/components/Dashboard/MetricCardWithSparkline';
import SlowQueriesSummary from '@/components/Dashboard/SlowQueriesSummary';
import DatabaseSizeCard from '@/components/Dashboard/DatabaseSizeCard';
import ConnectionPoolMini from '@/components/Dashboard/ConnectionPoolMini';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, BarController } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, BarController);

const MAX_HISTORY_POINTS = 20;

export default function Dashboard() {
  const { t } = useTranslation();
  const [dbStats, setDbStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 스파크라인용 히스토리 데이터
  const [connectionHistory, setConnectionHistory] = useState<number[]>([]);
  const [cacheHistory, setCacheHistory] = useState<number[]>([]);
  const [txHistory, setTxHistory] = useState<number[]>([]);
  const [deadlockHistory, setDeadlockHistory] = useState<number[]>([]);
  const [prevTxCommit, setPrevTxCommit] = useState<number | null>(null);

  const updateHistory = useCallback((setter: React.Dispatch<React.SetStateAction<number[]>>, value: number) => {
    setter(prev => {
      const newHistory = [...prev, value];
      if (newHistory.length > MAX_HISTORY_POINTS) {
        return newHistory.slice(-MAX_HISTORY_POINTS);
      }
      return newHistory;
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await monitoringApi.getDatabaseStats();
        const data = res.data.data || res.data;
        setDbStats(data);

        // 스파크라인 히스토리 업데이트
        const numbackends = parseInt(data.numbackends || '0');
        updateHistory(setConnectionHistory, numbackends);

        const blksHit = parseFloat(data.blks_hit || '0');
        const blksRead = parseFloat(data.blks_read || '0');
        const cacheRatio = blksHit + blksRead > 0 ? (blksHit / (blksHit + blksRead)) * 100 : 0;
        updateHistory(setCacheHistory, cacheRatio);

        // 트랜잭션/초 계산
        const currentTxCommit = parseInt(data.xact_commit || '0');
        if (prevTxCommit !== null) {
          const txPerInterval = Math.max(0, (currentTxCommit - prevTxCommit) / 5); // 5초 간격
          updateHistory(setTxHistory, txPerInterval);
        }
        setPrevTxCommit(currentTxCommit);

        const deadlocks = parseInt(data.deadlocks || '0');
        updateHistory(setDeadlockHistory, deadlocks);
      } catch (error) {
        console.error('Failed to fetch stats', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [updateHistory, prevTxCommit]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-gray-400 text-lg">{t('common.loading')}</div>
      </div>
    );
  }

  const cacheHitRatio = dbStats?.blks_hit && dbStats?.blks_read
    ? ((parseFloat(dbStats.blks_hit) / (parseFloat(dbStats.blks_hit) + parseFloat(dbStats.blks_read))) * 100).toFixed(1)
    : 'N/A';

  // 트렌드 계산
  const calculateTrend = (history: number[]): { trend: 'up' | 'down' | 'stable'; value: string } => {
    if (history.length < 2) return { trend: 'stable', value: '' };
    const recent = history.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const diff = last - first;
    const percentage = first !== 0 ? ((diff / first) * 100).toFixed(1) : '0';

    if (Math.abs(diff) < 0.01) return { trend: 'stable', value: '' };
    return {
      trend: diff > 0 ? 'up' : 'down',
      value: `${Math.abs(parseFloat(percentage))}%`,
    };
  };

  const connTrend = calculateTrend(connectionHistory);
  const cacheTrend = calculateTrend(cacheHistory);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">{t('dashboard')}</h2>
          <p className="text-gray-400 mt-1">{t('systemOnline')}</p>
        </div>
        <div className="text-sm text-gray-500">
          {t('lastUpdated')}: {new Date().toLocaleTimeString('ko-KR')}
        </div>
      </header>

      {/* Transaction ID Wraparound Warning */}
      <TxidWarning />

      {/* Main Metrics Grid with Sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCardWithSparkline
          label={t('activeConnections')}
          value={dbStats?.numbackends || '0'}
          icon="🔌"
          color="from-blue-500 to-cyan-500"
          sparklineData={connectionHistory}
          sparklineColor="#06b6d4"
          trend={connTrend.trend}
          trendValue={connTrend.value}
        />
        <MetricCardWithSparkline
          label={t('cacheHitRatio')}
          value={cacheHitRatio === 'N/A' ? cacheHitRatio : `${cacheHitRatio}%`}
          icon="⚡"
          color="from-emerald-500 to-green-500"
          sparklineData={cacheHistory}
          sparklineColor="#10b981"
          trend={cacheTrend.trend}
          trendValue={cacheTrend.value}
        />
        <MetricCardWithSparkline
          label="TPS (트랜잭션/초)"
          value={txHistory.length > 0 ? txHistory[txHistory.length - 1].toFixed(1) : '0'}
          icon="📊"
          color="from-purple-500 to-pink-500"
          sparklineData={txHistory}
          sparklineColor="#a855f7"
        />
        <MetricCardWithSparkline
          label={t('deadlocks')}
          value={dbStats?.deadlocks || '0'}
          icon="⚠️"
          color="from-orange-500 to-red-500"
          sparklineData={deadlockHistory}
          sparklineColor="#f97316"
        />
      </div>

      {/* Middle Section: System Health + Quick Actions + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SystemHealthCard />
        <QuickActions />
        <RecentAlerts />
      </div>

      {/* Database Activity */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">{t('databaseActivity')}</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
          <div className="space-y-2">
            <div className="text-sm text-gray-400">{t('blocksRead')}</div>
            <div className="text-xl font-semibold text-postgres-400 font-mono">
              {parseInt(dbStats?.blks_read || '0').toLocaleString()}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-gray-400">{t('blocksHit')}</div>
            <div className="text-xl font-semibold text-emerald-400 font-mono">
              {parseInt(dbStats?.blks_hit || '0').toLocaleString()}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-gray-400">{t('tuplesReturned')}</div>
            <div className="text-xl font-semibold text-purple-400 font-mono">
              {parseInt(dbStats?.tup_returned || '0').toLocaleString()}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-gray-400">{t('tuplesFetched')}</div>
            <div className="text-xl font-semibold text-pink-400 font-mono">
              {parseInt(dbStats?.tup_fetched || '0').toLocaleString()}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-gray-400">튜플 삽입</div>
            <div className="text-xl font-semibold text-blue-400 font-mono">
              {parseInt(dbStats?.tup_inserted || '0').toLocaleString()}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-gray-400">튜플 업데이트</div>
            <div className="text-xl font-semibold text-yellow-400 font-mono">
              {parseInt(dbStats?.tup_updated || '0').toLocaleString()}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-gray-400">튜플 삭제</div>
            <div className="text-xl font-semibold text-red-400 font-mono">
              {parseInt(dbStats?.tup_deleted || '0').toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Connection Pool + Slow Queries + Database Size */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ConnectionPoolMini />
        <SlowQueriesSummary />
        <DatabaseSizeCard />
      </div>
    </div>
  );
}
