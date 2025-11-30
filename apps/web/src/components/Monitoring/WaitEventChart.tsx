'use client';

import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function WaitEventChart({ data }: { data: any[] }) {
  const chartData = {
    labels: data.map(d => d.wait_event || 'CPU'),
    datasets: [
      {
        data: data.map(d => d.count),
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
        ],
        borderColor: 'rgba(0,0,0,0)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#94a3b8', // slate-400
        },
      },
    },
    cutout: '70%',
  };

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Wait Events</h3>
      <div className="h-64 flex items-center justify-center">
        {data.length > 0 ? (
          <Doughnut data={chartData} options={options} />
        ) : (
          <p className="text-gray-500">No wait events detected</p>
        )}
      </div>
    </div>
  );
}
