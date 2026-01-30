'use client';

import { useTranslation } from 'react-i18next';

export default function SlowQueryTable({ queries = [], onAnalyze }: { queries?: any[], onAnalyze: (query: string) => void }) {
  const { t } = useTranslation();

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">{t('queryPage.slowQueries')}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-slate-800 text-gray-200 uppercase font-medium">
            <tr>
              <th className="px-6 py-3">{t('queryPage.calls')}</th>
              <th className="px-6 py-3">{t('queryPage.totalTime')}</th>
              <th className="px-6 py-3">{t('queryPage.meanTime')}</th>
              <th className="px-6 py-3">{t('monitoringPage.query')}</th>
              <th className="px-6 py-3">{t('settingsPage.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {queries.map((row) => (
              <tr key={row.queryid} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 font-mono">{row.calls}</td>
                <td className="px-6 py-4 font-mono text-yellow-400">
                  {(row.total_exec_time / 1000).toFixed(2)}s
                </td>
                <td className="px-6 py-4 font-mono">
                  {row.mean_exec_time.toFixed(2)}ms
                </td>
                <td className="px-6 py-4 max-w-md truncate font-mono text-xs" title={row.query}>
                  {row.query}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onAnalyze(row.query)}
                    className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                  >
                    {t('queryPage.analyze')}
                  </button>
                </td>
              </tr>
            ))}
            {queries.length === 0 && (
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
