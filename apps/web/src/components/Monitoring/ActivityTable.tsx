'use client';

import { Activity } from '@/lib/api';

export default function ActivityTable({ data }: { data: Activity[] }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Current Activity</h3>
        <span className="text-sm text-gray-400">{data.length} active sessions</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-slate-800 text-gray-200 uppercase font-medium">
            <tr>
              <th className="px-6 py-3">PID</th>
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Application</th>
              <th className="px-6 py-3">State</th>
              <th className="px-6 py-3">Duration</th>
              <th className="px-6 py-3">Query</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {data.map((row) => (
              <tr key={row.pid} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 font-mono text-blue-400">{row.pid}</td>
                <td className="px-6 py-4">{row.usename}</td>
                <td className="px-6 py-4">{row.application_name || '-'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    row.state === 'active' ? 'bg-green-500/20 text-green-400' : 
                    row.state === 'idle' ? 'bg-gray-500/20 text-gray-400' : 
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {row.state}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono">
                  {row.duration_ms ? `${(row.duration_ms / 1000).toFixed(2)}s` : '-'}
                </td>
                <td className="px-6 py-4 max-w-xs truncate" title={row.query}>
                  {row.query}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No active sessions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
