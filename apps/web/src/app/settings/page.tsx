'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AlertConfig from '@/components/Settings/AlertConfig';
import SettingsTabs from '@/components/Settings/SettingsTabs';
import GeneralSettings from '@/components/Settings/GeneralSettings';
import VacuumSettings from '@/components/Vacuum/VacuumSettings';
import { vacuumApi, AutovacuumStat } from '@/lib/api';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('general');
  const [autovacuumStats, setAutovacuumStats] = useState<AutovacuumStat[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'vacuum' && autovacuumStats.length === 0) {
      fetchVacuumStats();
    }
  }, [activeTab]);

  const fetchVacuumStats = async () => {
    setLoading(true);
    try {
      const res = await vacuumApi.getAutovacuumStats();
      setAutovacuumStats(res.data.tables || []);
    } catch (error) {
      console.error('Failed to fetch vacuum stats', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <header className="space-y-2">
        <h2 className="text-3xl font-bold text-white">{t('settingsPage.title')}</h2>
        <p className="text-gray-400">{t('settingsPage.subtitle')}</p>
      </header>

      <div className="max-w-7xl space-y-6">
        <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="animate-in fade-in duration-300">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'alerts' && <AlertConfig />}
          {activeTab === 'vacuum' && (
            loading ? <div className="text-gray-400">Loading vacuum data...</div> : <VacuumSettings tables={autovacuumStats} />
          )}
        </div>
      </div>
    </div>
  );
}
