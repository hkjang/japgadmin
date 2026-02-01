'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import VacuumExecutor from '@/components/Vacuum/VacuumExecutor';
import VacuumHistory from '@/components/Vacuum/VacuumHistory';
import AutovacuumMonitor from '@/components/Vacuum/AutovacuumMonitor';
import VacuumSettings from '@/components/Vacuum/VacuumSettings';
import { vacuumApi, VacuumHistoryItem, AutovacuumStat } from '@/lib/api';

export default function VacuumPage() {
  const { t } = useTranslation();
  const [history, setHistory] = useState<VacuumHistoryItem[]>([]);
  const [autovacuumStats, setAutovacuumStats] = useState<AutovacuumStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [selectedTableForVacuum, setSelectedTableForVacuum] = useState<string>('');

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

  const handleVacuumTable = (tableName: string) => {
    setSelectedTableForVacuum(tableName);
    setActiveTab('overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-8 space-y-6">
      <header className="space-y-2">
        <h2 className="text-3xl font-bold text-white">{t('vacuumPage.title')}</h2>
        <p className="text-gray-400">{t('vacuumPage.subtitle')}</p>
      </header>

      <div className="flex gap-6 border-b border-gray-700">
        <button 
          onClick={() => setActiveTab('overview')} 
          className={`pb-3 px-2 transition-colors ${activeTab === 'overview' ? 'border-b-2 border-postgres-500 text-white font-medium' : 'text-gray-400 hover:text-gray-300'}`}
        >
          개요
        </button>
        <button 
          onClick={() => setActiveTab('settings')} 
          className={`pb-3 px-2 transition-colors ${activeTab === 'settings' ? 'border-b-2 border-postgres-500 text-white font-medium' : 'text-gray-400 hover:text-gray-300'}`}
        >
          설정
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <VacuumExecutor 
            onExecute={fetchData} 
            tables={autovacuumStats}
            targetTable={selectedTableForVacuum}
          />
          <VacuumHistory history={history} />
          <AutovacuumMonitor 
            data={autovacuumStats} 
            onVacuum={handleVacuumTable}
          />
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="animate-in fade-in duration-300">
          <VacuumSettings tables={autovacuumStats} />
        </div>
      )}
    </div>
  );
}
