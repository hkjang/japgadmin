'use client';

import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { AutovacuumStat } from '@/lib/api';

export default function AutovacuumMonitor({ data }: { data: AutovacuumStat[] }) {
  const { t } = useTranslation();

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">{t('vacuumPage.autovacuumActivity')}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-slate-800 text-gray-200 uppercase font-medium">
            <tr>
              <th className="px-6 py-3">{t('vacuumPage.tableName')}</th>
              <th className="px-6 py-3">{t('vacuumPage.deadTuples')}</th>
              <th className="px-6 py-3">{t('vacuumPage.liveTuples')}</th>
              <th className="px-6 py-3">Dead %</th>
              <th className="px-6 py-3">{t('vacuumPage.lastAutovacuum')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {data.map((row, idx) => (
              <tr key={`${row.schemaname}.${row.table_name}-${idx}`} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 font-medium text-white">
                  {row.schemaname}.{row.table_name}
                </td>
                <td className="px-6 py-4 font-mono text-red-400">
                  {row.dead_tuples.toLocaleString()}
                </td>
                <td className="px-6 py-4 font-mono">
                  {row.live_tuples.toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${parseFloat(row.dead_tuple_percentage) > 20 ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(parseFloat(row.dead_tuple_percentage), 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs">{row.dead_tuple_percentage}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs">
                  {row.last_autovacuum 
                    ? formatDistanceToNow(new Date(row.last_autovacuum), { addSuffix: true })
                    : t('vacuumPage.never')}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  {t('common.noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
