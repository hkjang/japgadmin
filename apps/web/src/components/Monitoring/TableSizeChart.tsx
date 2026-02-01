'use client';

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

interface TableSizeData {
  schemaname?: string;
  tablename: string;
  size?: string;
  size_bytes?: number;
  table_bytes?: number;
  index_bytes?: number;
}

export default function TableSizeChart({ data }: { data: TableSizeData[] }) {
  // 빈 데이터 처리
  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center">
        <p className="text-gray-500">테이블 데이터가 없습니다</p>
      </div>
    );
  }

  const validData = data.slice(0, 10).filter((d) => d.tablename);

  const chartData = {
    labels: validData.map((d) => d.tablename),
    datasets: [
      {
        label: '테이블 크기',
        data: validData.map((d) => {
          const bytes = d.table_bytes || d.size_bytes || 0;
          return bytes / 1024 / 1024; // MB
        }),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        stack: 'Stack 0',
      },
      {
        label: '인덱스 크기',
        data: validData.map((d) => {
          const bytes = d.index_bytes || 0;
          return bytes / 1024 / 1024; // MB
        }),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        stack: 'Stack 0',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#94a3b8' },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw || 0;
            if (value < 1) {
              return `${context.dataset.label}: ${(value * 1024).toFixed(2)} KB`;
            }
            return `${context.dataset.label}: ${value.toFixed(2)} MB`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      y: {
        stacked: true,
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        title: {
          display: true,
          text: '크기 (MB)',
          color: '#94a3b8',
        },
      },
    },
  };

  return (
    <div className="h-80">
      <Bar data={chartData} options={options} />
    </div>
  );
}
