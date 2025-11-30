'use client';

import { useState } from 'react';
import { vacuumApi } from '@/lib/api';

export default function VacuumExecutor({ onExecute }: { onExecute: () => void }) {
  const [tableName, setTableName] = useState('');
  const [vacuumType, setVacuumType] = useState<'VACUUM' | 'VACUUM FULL' | 'ANALYZE'>('VACUUM');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName) return;

    setLoading(true);
    setMessage(null);

    try {
      await vacuumApi.execute(tableName, vacuumType);
      setMessage({ type: 'success', text: `Successfully executed ${vacuumType} on ${tableName}` });
      setTableName('');
      onExecute(); // Refresh history
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Execution failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Manual Vacuum Execution</h3>
      <form onSubmit={handleExecute} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Table Name</label>
          <input
            type="text"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="public.users"
            className="w-full bg-slate-800 border border-gray-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Operation Type</label>
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
          disabled={loading}
          className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
            loading 
              ? 'bg-blue-600/50 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? 'Executing...' : 'Execute Operation'}
        </button>
      </form>
    </div>
  );
}
