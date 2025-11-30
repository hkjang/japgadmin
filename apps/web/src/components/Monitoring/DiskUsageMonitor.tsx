'use client';

import { useEffect, useState } from 'react';
import { monitoringApi } from '@/lib/api';
import { Bar } from 'react-chartjs-2';

export default function DiskUsageMonitor() {
  const [diskData, setDiskData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await monitoringApi.getDiskUsage();
        setDiskData(res.data);
      } catch (error) {
        console.error('Failed to fetch disk usage:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, []);

  if (loading || !diskData) {
    return (
      <div className="glass-card p-6">
        <div className="text-center text-gray-400">로딩 중...</div>
      </div>
    );
  }

  const { database, tables } = diskData;

  // Chart data for top tables
  const chartData = {
    labels: tables.slice(0, 10).map((t: any) => t.table_name),
    datasets: [
      {
        label: '테이블 크기',
        data: tables.slice(0, 10).map((t: any) => t.table_bytes),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
      },
      {
        label: '인덱스 크기',
        data: tables.slice(0, 10).map((t: any) => t.index_bytes),
        backgroundColor: 'rgba(168, 85, 247, 0.7)',
      },
    ],
  };

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
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            const bytes = context.parsed.y;
            const mb = (bytes / (1024 * 1024)).toFixed(2);
            label += `${mb} MB`;
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
        },
        ticks: {
          color: '#9CA3AF',
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        stacked: true,
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
        },
        ticks: {
          color: '#9CA3AF',
          callback: function (value: any) {
            const mb = (value / (1024 * 1024)).toFixed(0);
            return `${mb} MB`;
          },
        },
      },
    },
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">💾 디스크 사용량</h3>
          <p className="text-sm text-gray-400 mt-1">
            총 데이터베이스 크기: <span className="text-postgres-400 font-semibold">{database.database_size}</span>
          </p>
        </div>
      </div>

      {/* Top Tables Chart */}
      <div className="mb-6" style={{ height: '300px' }}>
        <h4 className="text-sm font-medium text-gray-300 mb-3">상위 10개 테이블 (크기별)</h4>
        <Bar data={chartData} options={chartOptions} />
      </div>

      {/* Tables List */}
      <div className="overflow-x-auto">
        <h4 className="text-sm font-medium text-gray-300 mb-3">테이블 크기 상세</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-400 font-medium">테이블</th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium">전체 크기</th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium">테이블</th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium">인덱스</th>
            </tr>
          </thead>
          <tbody>
            {tables.slice(0, 10).map((table: any, index: number) => (
              <tr key={index} className="border-b border-gray-800 hover:bg-dark-700/50">
                <td className="py-3 px-4 text-white font-mono text-xs">{table.table_name}</td>
                <td className="py-3 px-4 text-right text-postgres-400 font-semibold">{table.total_size}</td>
                <td className="py-3 px-4 text-right text-gray-300">{table.table_size}</td>
                <td className="py-3 px-4 text-right text-purple-400">{table.index_size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
