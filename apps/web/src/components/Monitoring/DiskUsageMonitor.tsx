'use client';

import { useEffect, useState } from 'react';
import { monitoringApi } from '@/lib/api';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface DatabaseInfo {
  database_name: string;
  size: string;
  size_bytes: number;
  connections: number;
  commits: number;
  rollbacks: number;
  cache_hit_ratio: number;
}

interface TableInfo {
  database_name: string;
  schemaname: string;
  tablename: string;
  total_size: string;
  total_bytes: number;
  table_size: string;
  table_bytes: number;
  index_size: string;
  index_bytes: number;
  row_estimate: number;
}

interface TableDataResponse {
  database: string;
  tables: TableInfo[];
  totalCount: number;
}

export default function DiskUsageMonitor() {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [tableData, setTableData] = useState<TableDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'databases' | 'tables'>('databases');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const [dbRes, tableRes] = await Promise.all([
          monitoringApi.getDatabases(),
          monitoringApi.getDatabaseTableSizes(),
        ]);
        setDatabases(dbRes.data.databases || []);
        setTableData({
          database: tableRes.data.database || 'unknown',
          tables: tableRes.data.tables || [],
          totalCount: tableRes.data.totalCount || 0,
        });
      } catch (err: any) {
        console.error('Failed to fetch disk usage:', err);
        setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="text-center text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">💾 디스크 사용량</h3>
        <div className="text-center text-red-400 py-4">{error}</div>
      </div>
    );
  }

  const totalSize = databases.reduce((acc, db) => acc + (db.size_bytes || 0), 0);

  // Database chart data
  const dbChartData = {
    labels: databases.map((db) => db.database_name),
    datasets: [
      {
        label: '데이터베이스 크기',
        data: databases.map((db) => db.size_bytes),
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)',
          'rgba(168, 85, 247, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(239, 68, 68, 0.7)',
        ],
      },
    ],
  };

  // Table chart data
  const tableChartData = tableData
    ? {
        labels: tableData.tables.slice(0, 10).map((t) => `${t.schemaname}.${t.tablename}`),
        datasets: [
          {
            label: '테이블 크기',
            data: tableData.tables.slice(0, 10).map((t) => t.table_bytes),
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
          },
          {
            label: '인덱스 크기',
            data: tableData.tables.slice(0, 10).map((t) => t.index_bytes),
            backgroundColor: 'rgba(168, 85, 247, 0.7)',
          },
        ],
      }
    : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#9CA3AF',
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'rgba(75, 85, 99, 0.5)',
        borderWidth: 1,
        callbacks: {
          label: function (context: any) {
            const bytes = context.parsed.y || context.parsed;
            if (bytes >= 1024 * 1024 * 1024) {
              return `${context.dataset.label}: ${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
            }
            return `${context.dataset.label}: ${(bytes / (1024 * 1024)).toFixed(2)} MB`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: activeTab === 'tables',
        grid: { color: 'rgba(75, 85, 99, 0.2)' },
        ticks: {
          color: '#9CA3AF',
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        stacked: activeTab === 'tables',
        grid: { color: 'rgba(75, 85, 99, 0.2)' },
        ticks: {
          color: '#9CA3AF',
          callback: function (value: any) {
            if (value >= 1024 * 1024 * 1024) {
              return `${(value / (1024 * 1024 * 1024)).toFixed(0)} GB`;
            }
            return `${(value / (1024 * 1024)).toFixed(0)} MB`;
          },
        },
      },
    },
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${bytes} B`;
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">💾 디스크 사용량</h3>
          <p className="text-sm text-gray-400 mt-1">
            총 사용량: <span className="text-postgres-400 font-semibold">{formatBytes(totalSize)}</span>
            <span className="mx-2">|</span>
            데이터베이스: <span className="text-blue-400 font-semibold">{databases.length}개</span>
          </p>
        </div>
        {/* Tab buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('databases')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              activeTab === 'databases'
                ? 'bg-postgres-500 text-white'
                : 'bg-dark-700 text-gray-400 hover:text-white'
            }`}
          >
            데이터베이스
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              activeTab === 'tables'
                ? 'bg-postgres-500 text-white'
                : 'bg-dark-700 text-gray-400 hover:text-white'
            }`}
          >
            테이블
          </button>
        </div>
      </div>

      {activeTab === 'databases' ? (
        <>
          {/* Database Chart */}
          <div className="mb-6" style={{ height: '250px' }}>
            <Bar data={dbChartData} options={chartOptions} />
          </div>

          {/* Database List */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">데이터베이스</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">크기</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">연결</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">캐시 적중률</th>
                </tr>
              </thead>
              <tbody>
                {databases.map((db, index) => (
                  <tr key={index} className="border-b border-gray-800 hover:bg-dark-700/50">
                    <td className="py-3 px-4 text-white font-mono text-xs">{db.database_name}</td>
                    <td className="py-3 px-4 text-right text-postgres-400 font-semibold">{db.size}</td>
                    <td className="py-3 px-4 text-right text-gray-300">{db.connections || 0}</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`${
                          parseFloat(db.cache_hit_ratio?.toString() || '0') >= 90
                            ? 'text-green-400'
                            : parseFloat(db.cache_hit_ratio?.toString() || '0') >= 70
                            ? 'text-yellow-400'
                            : 'text-red-400'
                        }`}
                      >
                        {parseFloat(db.cache_hit_ratio?.toString() || '0').toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Table Header */}
          {tableData && (
            <div className="mb-4 p-3 bg-dark-700/50 rounded-lg">
              <span className="text-sm text-gray-400">현재 데이터베이스: </span>
              <span className="text-postgres-400 font-semibold">{tableData.database}</span>
              <span className="mx-2 text-gray-600">|</span>
              <span className="text-sm text-gray-400">테이블 수: </span>
              <span className="text-blue-400 font-semibold">{tableData.totalCount}개</span>
            </div>
          )}

          {/* Empty state */}
          {(!tableData || tableData.tables.length === 0) ? (
            <div className="text-center text-gray-400 py-8">
              테이블 데이터가 없습니다.
            </div>
          ) : (
            <>
              {/* Table Chart */}
              {tableChartData && tableData.tables.length > 0 && (
                <div className="mb-6" style={{ height: '250px' }}>
                  <Bar data={tableChartData} options={chartOptions} />
                </div>
              )}

              {/* Table List */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">테이블</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">전체 크기</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">테이블</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">인덱스</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">행 수 (추정)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.tables.slice(0, 20).map((table, index) => (
                      <tr key={index} className="border-b border-gray-800 hover:bg-dark-700/50">
                        <td className="py-3 px-4 text-white font-mono text-xs">
                          {table.schemaname}.{table.tablename}
                        </td>
                        <td className="py-3 px-4 text-right text-postgres-400 font-semibold">
                          {table.total_size}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300">{table.table_size}</td>
                        <td className="py-3 px-4 text-right text-purple-400">{table.index_size}</td>
                        <td className="py-3 px-4 text-right text-gray-400">
                          {table.row_estimate?.toLocaleString() || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
