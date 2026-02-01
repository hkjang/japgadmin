'use client';

import { useEffect, useState } from 'react';
import { monitoringApi } from '@/lib/api';

interface BgWriterData {
  checkpoints_timed: number;
  checkpoints_req: number;
  checkpoint_write_time: number;
  checkpoint_sync_time: number;
  buffers_checkpoint: number;
  buffers_clean: number;
  maxwritten_clean: number;
  buffers_backend: number;
  buffers_backend_fsync: number;
  buffers_alloc: number;
}

export default function BgWriterStats() {
  const [data, setData] = useState<BgWriterData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await monitoringApi.getBgwriterStats();
        setData(res.data.data);
      } catch (error) {
        console.error('Failed to fetch bgwriter stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // 30초마다
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 bg-dark-600 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-dark-600 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Background Writer 통계</h3>
        <p className="text-gray-500 text-center py-4">데이터를 불러올 수 없습니다</p>
      </div>
    );
  }

  const totalCheckpoints = (data.checkpoints_timed || 0) + (data.checkpoints_req || 0);
  const requestedCheckpointRatio = totalCheckpoints > 0
    ? ((data.checkpoints_req || 0) / totalCheckpoints * 100).toFixed(1)
    : '0';

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const stats = [
    {
      label: '체크포인트 (정기)',
      value: formatNumber(data.checkpoints_timed || 0),
      description: '타이머에 의해 실행',
      color: 'text-blue-400',
    },
    {
      label: '체크포인트 (요청)',
      value: formatNumber(data.checkpoints_req || 0),
      description: '강제로 요청됨',
      color: parseFloat(requestedCheckpointRatio) > 20 ? 'text-yellow-400' : 'text-emerald-400',
      warning: parseFloat(requestedCheckpointRatio) > 20,
    },
    {
      label: '체크포인트 쓰기 시간',
      value: formatTime(data.checkpoint_write_time || 0),
      description: '디스크에 쓰는 시간',
      color: 'text-purple-400',
    },
    {
      label: '체크포인트 동기화 시간',
      value: formatTime(data.checkpoint_sync_time || 0),
      description: 'fsync 호출 시간',
      color: 'text-pink-400',
    },
  ];

  const bufferStats = [
    {
      label: '체크포인트 버퍼',
      value: formatNumber(data.buffers_checkpoint || 0),
      color: 'bg-blue-500',
    },
    {
      label: 'bgwriter 버퍼',
      value: formatNumber(data.buffers_clean || 0),
      color: 'bg-emerald-500',
    },
    {
      label: '백엔드 버퍼',
      value: formatNumber(data.buffers_backend || 0),
      color: (data.buffers_backend || 0) > 10000 ? 'bg-yellow-500' : 'bg-purple-500',
    },
    {
      label: '할당된 버퍼',
      value: formatNumber(data.buffers_alloc || 0),
      color: 'bg-gray-500',
    },
  ];

  const totalBuffers = (data.buffers_checkpoint || 0) + (data.buffers_clean || 0) + (data.buffers_backend || 0);

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Background Writer 통계</h3>
          <p className="text-sm text-gray-400 mt-1">버퍼 관리 및 체크포인트 활동</p>
        </div>
        <div className="text-xs text-gray-500">30초마다 자동 갱신</div>
      </div>

      {/* Checkpoint Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <div key={index} className="p-3 bg-dark-700/50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-600 mt-1">{stat.description}</div>
          </div>
        ))}
      </div>

      {/* Buffer Distribution */}
      <div className="mb-4">
        <div className="text-sm text-gray-400 mb-2">버퍼 쓰기 분포</div>
        <div className="h-4 flex rounded-full overflow-hidden bg-dark-700">
          {bufferStats.map((stat, index) => {
            const value = parseInt(stat.value.replace(/[KM]/g, '')) || 0;
            const width = totalBuffers > 0 ? (value / totalBuffers) * 100 : 0;
            return (
              <div
                key={index}
                className={`${stat.color} transition-all duration-500`}
                style={{ width: `${Math.max(width, 1)}%` }}
                title={`${stat.label}: ${stat.value}`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          {bufferStats.map((stat, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div className={`w-3 h-3 rounded ${stat.color}`} />
              <span className="text-gray-400">{stat.label}: {stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {parseFloat(requestedCheckpointRatio) > 20 && (
        <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded mt-4">
          <p className="text-sm text-yellow-200">
            ⚠️ <strong>주의:</strong> 요청된 체크포인트 비율이 {requestedCheckpointRatio}%입니다.
            checkpoint_completion_target 또는 max_wal_size 설정을 검토하세요.
          </p>
        </div>
      )}

      {(data.buffers_backend || 0) > 10000 && (
        <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded mt-4">
          <p className="text-sm text-yellow-200">
            ⚠️ <strong>주의:</strong> 백엔드에서 직접 쓴 버퍼가 많습니다.
            shared_buffers 또는 bgwriter 설정 조정을 검토하세요.
          </p>
        </div>
      )}
    </div>
  );
}
