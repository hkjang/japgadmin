'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { queryApi } from '@/lib/api';
import SlowQueryTable from '@/components/Query/SlowQueryTable';
import QueryPlanViewer from '@/components/Query/QueryPlanViewer';

export default function QueryPage() {
  const { t } = useTranslation();
  const [queries, setQueries] = useState<any[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<string>('');

  useEffect(() => {
    loadQueries();
  }, []);

  const loadQueries = async () => {
    try {
      const res = await queryApi.getSlowQueries();
      // API returns { queries: [], count: number, ... } or { error: string }
      if (res.data && Array.isArray(res.data.queries)) {
        setQueries(res.data.queries);
      } else {
        console.warn('Unexpected API response format or error:', res.data);
        setQueries([]);
      }
    } catch (error) {
      console.error('Failed to load slow queries:', error);
      setQueries([]);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <header className="space-y-2">
        <h2 className="text-3xl font-bold text-white">{t('queryPage.title')}</h2>
        <p className="text-gray-400">{t('queryPage.subtitle')}</p>
      </header>

      <SlowQueryTable 
        queries={queries} 
        onAnalyze={setSelectedQuery} 
      />
      <QueryPlanViewer initialQuery={selectedQuery} />
    </div>
  );
}
