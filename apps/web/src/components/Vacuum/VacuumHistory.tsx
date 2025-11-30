'use client';

import { formatDistanceToNow } from 'date-fns';
import { VacuumHistoryItem } from '@/lib/api';

export default function VacuumHistory({ history }: { history: VacuumHistoryItem[] }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Execution History</h3>
      </div>
      <div className="overflow-x-auto max-h-[400px]">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-slate-800 text-gray-200 uppercase font-medium sticky top-0">
            <tr>
              <th className="px-6 py-3">Time</th>
              <th className="px-6 py-3">Table</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Duration</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {history.map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  {formatDistanceToNow(new Date(row.timestamp), { addSuffix: true })}
                </td>
                <td className="px-6 py-4">{row.tableName}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-slate-700 rounded text-xs text-white">
                    {row.vacuumType}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono">
                  {row.duration ? `${row.duration}ms` : '-'}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    row.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No execution history found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
