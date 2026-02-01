'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { vacuumApi, AutovacuumStat } from '@/lib/api';

interface VacuumExecutorProps {
  onExecute: () => void;
  tables: AutovacuumStat[];
  targetTable?: string;
}

export default function VacuumExecutor({ onExecute, tables, targetTable }: VacuumExecutorProps) {
  const { t } = useTranslation();
  const [tableName, setTableName] = useState(targetTable || '');
  const [vacuumType, setVacuumType] = useState<'VACUUM' | 'VACUUM FULL' | 'ANALYZE'>('VACUUM');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (targetTable) {
      setTableName(targetTable);
    }
  }, [targetTable]);

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName) return;

    setLoading(true);
    setMessage(null);

    try {
      await vacuumApi.execute(tableName, vacuumType);
      setMessage({ type: 'success', text: t('common.success') });
      onExecute();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || t('common.error') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{t('vacuumPage.manualExecution')}</h3>
      <form onSubmit={handleExecute} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">{t('vacuumPage.selectTargetTable') || '대상 테이블 선택'}</label>
          <div className="relative">
            <select
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="w-full bg-slate-800 border border-gray-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              required
            >
              <option value="" disabled>
                {t('vacuumPage.selectWait') || '테이블을 선택하세요'}
              </option>
              {tables.map((table) => {
                const fullTableName = `${table.schemaname}.${table.table_name}`;
                return (
                  <option key={fullTableName} value={fullTableName}>
                    {fullTableName} (Dead: {table.dead_tuples.toLocaleString()})
                  </option>
                );
              })}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">{t('vacuumPage.operationType')}</label>
          <select
            value={vacuumType}
            onChange={(e) => setVacuumType(e.target.value as any)}
            className="w-full bg-slate-800 border border-gray-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="VACUUM">VACUUM (Standard)</option>
            <option value="VACUUM FULL">VACUUM FULL (Reclaim Space)</option>
            <option value="ANALYZE">ANALYZE (Update Stats)</option>
          </select>
        </div>

        {message && (
          <div className={`p-3 rounded-md text-sm ${
            message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !tableName}
          className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
            loading || !tableName
              ? 'bg-blue-600/50 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? t('vacuumPage.executing') : t('vacuumPage.execute')}
        </button>
      </form>
    </div>
  );
}
