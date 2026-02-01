'use client';

import MiniSparkline from './MiniSparkline';

interface MetricCardWithSparklineProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  sparklineData: number[];
  sparklineColor: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

export default function MetricCardWithSparkline({
  label,
  value,
  icon,
  color,
  sparklineData,
  sparklineColor,
  trend,
  trendValue,
}: MetricCardWithSparklineProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend) {
      case 'up':
        return <span className="text-emerald-400">↑</span>;
      case 'down':
        return <span className="text-red-400">↓</span>;
      default:
        return <span className="text-gray-400">→</span>;
    }
  };

  return (
    <div className="stat-card group overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {trend && trendValue && (
          <div className="flex items-center gap-1 text-xs">
            {getTrendIcon()}
            <span className="text-gray-400">{trendValue}</span>
          </div>
        )}
      </div>

      <div className={`text-2xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent mb-1`}>
        {value}
      </div>
      <div className="text-sm text-gray-400 mb-3">{label}</div>

      {sparklineData.length > 1 && (
        <div className="mt-auto pt-2 border-t border-dark-600">
          <MiniSparkline data={sparklineData} color={sparklineColor} height={35} />
        </div>
      )}
    </div>
  );
}
