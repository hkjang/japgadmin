'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { queryApi } from '@/lib/api';

interface SlowQuery {
  query: string;
  calls: number;
  total_time: number;
  mean_time: number;
}

export default function SlowQueriesSummary() {
  const [queries, setQueries] = useState<SlowQuery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await queryApi.getSlowQueries();
        setQueries((res.data.slowQueries || []).slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch slow queries', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (ms: number) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    return `${ms.toFixed(0)}ms`;
  };

  const truncateQuery = (query: string, maxLength = 60) => {
    const normalized = query.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return normalized.slice(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 bg-dark-600 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-dark-600 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">느린 쿼리 TOP 5</h3>
        <Link
          href="/query"
          className="text-xs text-postgres-400 hover:text-postgres-300 transition-colors"
        >
          전체 보기 →
        </Link>
      </div>

      {queries.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-3xl mb-2">✨</div>
          <div className="text-sm">느린 쿼리가 없습니다!</div>
        </div>
      ) : (
        <div className="space-y-3">
          {queries.map((query, index) => (
            <div
              key={index}
              className="p-3 rounded-lg bg-dark-700/50 border border-dark-600 hover:border-dark-500 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  index === 0 ? 'bg-red-500/20 text-red-400' :
                  index === 1 ? 'bg-orange-500/20 text-orange-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-gray-300 truncate" title={query.query}>
                    {truncateQuery(query.query)}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">평균:</span>
                      <span className="text-red-400 font-mono">{formatTime(query.mean_time)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">호출:</span>
                      <span className="text-blue-400 font-mono">{query.calls.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">총:</span>
                      <span className="text-purple-400 font-mono">{formatTime(query.total_time)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
