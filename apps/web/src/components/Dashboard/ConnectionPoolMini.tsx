'use client';

import { useEffect, useState } from 'react';
import { monitoringApi } from '@/lib/api';

export default function ConnectionPoolMini() {
  const [connections, setConnections] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await monitoringApi.getConnectionStats();
        setConnections(res.data.connections);
      } catch (error) {
        console.error('Failed to fetch connection stats', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 bg-dark-600 rounded w-1/3 mb-4" />
        <div className="h-32 bg-dark-600 rounded" />
      </div>
    );
  }

  const usage = parseFloat(connections?.usage_percentage || 0);
  const total = parseInt(connections?.total_connections || 0);
  const max = parseInt(connections?.max_connections || 100);
  const active = parseInt(connections?.active_connections || 0);
  const idle = parseInt(connections?.idle_connections || 0);
  const idleInTx = parseInt(connections?.idle_in_transaction || 0);

  const getUsageColor = () => {
    if (usage >= 80) return 'from-red-500 to-red-600';
    if (usage >= 50) return 'from-yellow-500 to-yellow-600';
    return 'from-emerald-500 to-green-600';
  };

  const getUsageTextColor = () => {
    if (usage >= 80) return 'text-red-400';
    if (usage >= 50) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  // 원형 게이지 각도 계산
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (usage / 100) * circumference;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">연결 풀 상태</h3>
        <span className={`text-sm font-medium ${getUsageTextColor()}`}>
          {usage >= 80 ? '주의' : usage >= 50 ? '경고' : '정상'}
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* 원형 게이지 */}
        <div className="relative w-36 h-36">
          <svg className="w-full h-full transform -rotate-90">
            {/* 배경 원 */}
            <circle
              cx="72"
              cy="72"
              r={radius}
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              className="text-dark-600"
            />
            {/* 진행 원 */}
            <circle
              cx="72"
              cy="72"
              r={radius}
              stroke="url(#gradient)"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              style={{
                strokeDasharray: circumference,
                strokeDashoffset,
                transition: 'stroke-dashoffset 0.5s ease',
              }}
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" className={usage >= 80 ? 'stop-red-500' : usage >= 50 ? 'stop-yellow-500' : 'stop-emerald-500'} stopColor={usage >= 80 ? '#ef4444' : usage >= 50 ? '#eab308' : '#10b981'} />
                <stop offset="100%" className={usage >= 80 ? 'stop-red-600' : usage >= 50 ? 'stop-yellow-600' : 'stop-green-600'} stopColor={usage >= 80 ? '#dc2626' : usage >= 50 ? '#ca8a04' : '#16a34a'} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${getUsageTextColor()}`}>
              {usage.toFixed(0)}%
            </span>
            <span className="text-xs text-gray-500">사용률</span>
          </div>
        </div>

        {/* 연결 상세 정보 */}
        <div className="flex-1 space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-dark-600">
            <span className="text-sm text-gray-400">전체 연결</span>
            <span className="font-mono text-white">{total} / {max}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-dark-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-gray-400">활성</span>
            </div>
            <span className="font-mono text-emerald-400">{active}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-dark-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-sm text-gray-400">유휴</span>
            </div>
            <span className="font-mono text-gray-400">{idle}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-sm text-gray-400">유휴 트랜잭션</span>
            </div>
            <span className={`font-mono ${idleInTx > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>{idleInTx}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
