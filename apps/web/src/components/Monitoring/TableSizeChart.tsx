'use client';

import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function TableSizeChart({ data }: { data: any[] }) {
  const chartData = {
    labels: data.slice(0, 10).map(d => d.tablename),
    datasets: [
      {
        label: 'Table Size',
        data: data.slice(0, 10).map(d => d.table_bytes / 1024 / 1024), // MB
        backgroundColor: 'rgba(59, 130, 246, 0.8)', // Blue
        stack: 'Stack 0',
      },
      {
        label: 'Index Size',
        data: data.slice(0, 10).map(d => d.index_bytes / 1024 / 1024), // MB
        backgroundColor: 'rgba(16, 185, 129, 0.8)', // Green
        stack: 'Stack 0',
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        labels: { color: '#94a3b8' },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.raw.toFixed(2)} MB`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      y: {
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        title: {
          display: true,
          text: 'Size (MB)',
          color: '#94a3b8',
        },
      },
    },
  };

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Top 10 Tables by Size</h3>
      <div className="h-80">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
