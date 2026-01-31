'use client';

import { useEffect, useState } from 'react';
import { monitoringApi } from '@/lib/api';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function RealtimePerformanceChart() {
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await monitoringApi.getPerformanceHistory();
        const metrics = res.data.metrics;

        if (!metrics || metrics.timestamps.length === 0) {
          setChartData(null);
          return;
        }

        // Convert timestamps to readable time labels
        const labels = metrics.timestamps.map((ts: number) => {
          const date = new Date(ts);
          return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        });

        setChartData({
          labels,
          datasets: [
            {
              label: '활성 연결',
              data: metrics.connections,
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4,
              fill: true,
            },
            {
              label: '트랜잭션/sec',
              data: metrics.transactions,
              borderColor: 'rgb(168, 85, 247)',
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              tension: 0.4,
              fill: true,
            },
            {
              label: '캐시 적중률 (%)',
              data: metrics.cacheHitRatio,
              borderColor: 'rgb(16, 185, 129)',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              tension: 0.4,
              fill: true,
            },
          ],
        });
      } catch (error) {
        console.error('Failed to fetch performance history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // 5초마다 갱신
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="text-center text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">📊 실시간 성능 차트</h3>
        <div className="text-center text-gray-400 py-8">
          성능 기록이 없습니다. 잠시 후 데이터가 수집됩니다.
        </div>
      </div>
    );
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#9CA3AF',
          usePointStyle: true,
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'rgba(75, 85, 99, 0.5)',
        borderWidth: 1,
        titleColor: '#F3F4F6',
        bodyColor: '#D1D5DB',
        padding: 12,
        displayColors: true,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
        },
        ticks: {
          color: '#9CA3AF',
        },
      },
      y: {
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
        },
        ticks: {
          color: '#9CA3AF',
        },
      },
    },
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">📊 실시간 성능 차트</h3>
          <p className="text-sm text-gray-400 mt-1">최근 1시간 성능 메트릭</p>
        </div>
        <div className="text-xs text-gray-500">5초마다 자동 갱신</div>
      </div>
      <div style={{ height: '300px' }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
