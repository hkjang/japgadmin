'use client';

import { useState } from 'react';
import { queryApi } from '@/lib/api';

export default function QueryPlanViewer({ initialQuery }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyze, setAnalyze] = useState(false);

  // Update local state if prop changes
  if (initialQuery && query !== initialQuery) {
    setQuery(initialQuery);
  }

  const handleExplain = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const res = await queryApi.explain(query);
      setPlan(res.data.plan || res.data.error);
    } catch (error: any) {
      setPlan('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6 flex flex-col h-full">
      <h3 className="text-lg font-semibold text-white mb-4">Query Plan Analyzer</h3>
      
      <div className="space-y-4 flex-1 flex flex-col">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter SQL query to analyze..."
          className="w-full h-32 bg-slate-800 border border-gray-700 rounded-md p-4 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-gray-400 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={analyze}
              onChange={(e) => setAnalyze(e.target.checked)}
              className="rounded bg-slate-700 border-gray-600 text-blue-500 focus:ring-blue-500"
            />
            <span>Run EXPLAIN ANALYZE (Executes query)</span>
          </label>
          
          <button
            onClick={handleExplain}
            disabled={loading || !query}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              loading || !query
                ? 'bg-blue-600/50 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {loading ? 'Analyzing...' : 'Explain'}
          </button>
        </div>

        {plan && (
          <div className="flex-1 bg-slate-900 rounded-md p-4 overflow-auto border border-gray-800">
            <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">
              {plan}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
