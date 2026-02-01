'use client';

import { useEffect, useState } from 'react';
import { monitoringApi } from '@/lib/api';

interface HealthIndicator {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'critical';
  description: string;
}

export default function SystemHealthCard() {
  const [bgWriter, setBgWriter] = useState<any>(null);
  const [connections, setConnections] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bgRes, connRes] = await Promise.all([
          monitoringApi.getBgwriterStats(),
          monitoringApi.getConnectionStats(),
        ]);
        setBgWriter(bgRes.data.data);
        setConnections(connRes.data.connections);
      } catch (error) {
        console.error('Failed to fetch system health', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 bg-dark-600 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-dark-600 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const usagePercent = parseFloat(connections?.usage_percentage || 0);
  const checkpointRatio = bgWriter?.checkpoints_req
    ? (bgWriter.checkpoints_req / (bgWriter.checkpoints_req + bgWriter.checkpoints_timed) * 100).toFixed(1)
    : 0;

  const indicators: HealthIndicator[] = [
    {
      label: '연결 사용률',
      value: `${usagePercent}%`,
      status: usagePercent > 80 ? 'critical' : usagePercent > 50 ? 'warning' : 'good',
      description: `${connections?.total_connections || 0} / ${connections?.max_connections || 0} 연결`,
    },
    {
      label: '유휴 트랜잭션',
      value: connections?.idle_in_transaction || '0',
      status: (connections?.idle_in_transaction || 0) > 5 ? 'critical' : (connections?.idle_in_transaction || 0) > 0 ? 'warning' : 'good',
      description: '유휴 상태 트랜잭션 세션',
    },
    {
      label: '요청 체크포인트',
      value: `${checkpointRatio}%`,
      status: parseFloat(String(checkpointRatio)) > 50 ? 'critical' : parseFloat(String(checkpointRatio)) > 20 ? 'warning' : 'good',
      description: '강제 체크포인트 비율',
    },
    {
      label: '버퍼 백엔드 쓰기',
      value: bgWriter?.buffers_backend?.toLocaleString() || '0',
      status: (bgWriter?.buffers_backend || 0) > 10000 ? 'warning' : 'good',
      description: '백엔드에서 직접 쓴 버퍼',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      default: return 'bg-emerald-500';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-emerald-400';
    }
  };

  const overallStatus = indicators.some(i => i.status === 'critical')
    ? 'critical'
    : indicators.some(i => i.status === 'warning')
    ? 'warning'
    : 'good';

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">시스템 상태</h3>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
          overallStatus === 'critical' ? 'bg-red-500/20' :
          overallStatus === 'warning' ? 'bg-yellow-500/20' : 'bg-emerald-500/20'
        }`}>
          <div className={`w-2 h-2 rounded-full ${getStatusColor(overallStatus)} animate-pulse`} />
          <span className={`text-sm font-medium ${getStatusTextColor(overallStatus)}`}>
            {overallStatus === 'critical' ? '주의 필요' : overallStatus === 'warning' ? '경고' : '정상'}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {indicators.map((indicator, index) => (
          <div key={index} className="flex items-center justify-between py-2 border-b border-dark-600 last:border-0">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(indicator.status)}`} />
              <div>
                <div className="text-sm text-white">{indicator.label}</div>
                <div className="text-xs text-gray-500">{indicator.description}</div>
              </div>
            </div>
            <div className={`text-lg font-mono font-semibold ${getStatusTextColor(indicator.status)}`}>
              {indicator.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
