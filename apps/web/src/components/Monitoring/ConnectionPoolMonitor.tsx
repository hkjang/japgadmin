'use client';

import { useEffect, useState } from 'react';
import { monitoringApi } from '@/lib/api';

export default function ConnectionPoolMonitor() {
  const [connections, setConnections] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await monitoringApi.getConnectionStats();
        setConnections(res.data.connections);
      } catch (error) {
        console.error('Failed to fetch connection stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !connections) {
    return (
      <div className="glass-card p-6">
        <div className="text-center text-gray-400">로딩 중...</div>
      </div>
    );
  }

  const usagePercent = parseFloat(connections.usage_percentage || 0);
  const getStatusColor = () => {
    if (usagePercent >= 80) return 'text-red-400';
    if (usagePercent >= 50) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getProgressColor = () => {
    if (usagePercent >= 80) return 'from-red-600 to-red-500';
    if (usagePercent >= 50) return 'from-yellow-600 to-yellow-500';
    return 'from-green-600 to-green-500';
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">🔌 연결 풀 모니터링</h3>
          <p className="text-sm text-gray-400 mt-1">
            {connections.total_connections} / {connections.max_connections} 연결 사용 중
          </p>
        </div>
        <div className={`text-3xl font-bold ${getStatusColor()}`}>
          {usagePercent.toFixed(1)}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="w-full bg-dark-700 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${getProgressColor()}`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>

      {/* Connection Breakdown */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-dark-700/50 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">활성</div>
          <div className="text-2xl font-bold text-blue-400">
            {connections.active_connections || 0}
          </div>
        </div>
        <div className="text-center p-4 bg-dark-700/50 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">유휴</div>
          <div className="text-2xl font-bold text-gray-400">
            {connections.idle_connections || 0}
          </div>
        </div>
        <div className="text-center p-4 bg-dark-700/50 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">트랜잭션 유휴</div>
          <div className="text-2xl font-bold text-yellow-400">
            {connections.idle_in_transaction || 0}
          </div>
        </div>
      </div>

      {/* Warning */}
      {usagePercent >= 80 && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded">
          <p className="text-sm text-red-200">
            ⚠️ <strong>경고:</strong> 연결 풀 사용률이 80%를 초과했습니다. max_connections 설정 증가를 고려하세요.
          </p>
        </div>
      )}
    </div>
  );
}
