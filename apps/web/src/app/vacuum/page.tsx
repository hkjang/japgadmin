'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import VacuumExecutor from '@/components/Vacuum/VacuumExecutor';
import VacuumHistory from '@/components/Vacuum/VacuumHistory';
import AutovacuumMonitor from '@/components/Vacuum/AutovacuumMonitor';
import { vacuumApi, VacuumHistoryItem, AutovacuumStat } from '@/lib/api';

export default function VacuumPage() {
  const { t } = useTranslation();
  const [history, setHistory] = useState<VacuumHistoryItem[]>([]);
  const [autovacuumStats, setAutovacuumStats] = useState<AutovacuumStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [historyRes, statsRes] = await Promise.all([
        vacuumApi.getHistory(),
        vacuumApi.getAutovacuumStats()
      ]);
      setHistory(historyRes.data.history || []);
      setAutovacuumStats(statsRes.data.tables || []);
    } catch (error) {
      console.error('Failed to fetch vacuum data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="p-8 space-y-8">
      <header className="space-y-2">
        <h2 className="text-3xl font-bold text-white">{t('vacuumPage.title')}</h2>
        <p className="text-gray-400">{t('vacuumPage.subtitle')}</p>
      </header>

      <VacuumExecutor onExecute={fetchData} />
      <VacuumHistory history={history} />
      <AutovacuumMonitor data={autovacuumStats} />
    </div>
  );
}
