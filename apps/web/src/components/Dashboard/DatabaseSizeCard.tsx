'use client';

import { useEffect, useState } from 'react';
import { monitoringApi } from '@/lib/api';

interface TableInfo {
  table_name: string;
  total_size: string;
  total_bytes: number;
  table_bytes: number;
  index_bytes: number;
}

export default function DatabaseSizeCard() {
  const [database, setDatabase] = useState<any>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await monitoringApi.getDiskUsage();
        setDatabase(res.data.database);
        setTables((res.data.tables || []).slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch disk usage', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // 1분마다
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 bg-dark-600 rounded w-1/3 mb-4" />
        <div className="h-20 bg-dark-600 rounded mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-dark-600 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const maxSize = tables.length > 0 ? tables[0].total_bytes : 1;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">데이터베이스 용량</h3>
        <div className="text-xs text-gray-500">상위 5개 테이블</div>
      </div>

      {/* 전체 DB 크기 */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-postgres-600/20 to-postgres-500/10 border border-postgres-500/30 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400 mb-1">전체 데이터베이스</div>
            <div className="text-2xl font-bold text-postgres-400">
              {database?.database_size || 'N/A'}
            </div>
          </div>
          <div className="text-4xl">💾</div>
        </div>
      </div>

      {/* 테이블별 크기 */}
      {tables.length === 0 ? (
        <div className="text-center py-4 text-gray-500 text-sm">
          테이블 정보가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {tables.map((table, index) => {
            const ratio = (table.total_bytes / maxSize) * 100;
            const tableRatio = (table.table_bytes / table.total_bytes) * 100;
            const indexRatio = (table.index_bytes / table.total_bytes) * 100;

            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300 truncate max-w-[60%]" title={table.table_name}>
                    {table.table_name}
                  </span>
                  <span className="text-gray-400 font-mono text-xs">
                    {table.total_size}
                  </span>
                </div>
                <div className="h-3 bg-dark-700 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                    style={{ width: `${(tableRatio / 100) * ratio}%` }}
                    title={`테이블: ${tableRatio.toFixed(1)}%`}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                    style={{ width: `${(indexRatio / 100) * ratio}%` }}
                    title={`인덱스: ${indexRatio.toFixed(1)}%`}
                  />
                </div>
              </div>
            );
          })}

          {/* 범례 */}
          <div className="flex items-center gap-4 pt-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-gradient-to-r from-blue-500 to-cyan-500" />
              <span className="text-gray-400">테이블</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-gradient-to-r from-purple-500 to-pink-500" />
              <span className="text-gray-400">인덱스</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
