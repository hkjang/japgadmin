'use client';

import { useEffect, useState } from 'react';
import { monitoringApi } from '@/lib/api';

export default function ReplicationMonitor() {
  const [replication, setReplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await monitoringApi.getReplicationStatus();
        setReplication(res.data);
      } catch (error) {
        console.error('Failed to fetch replication status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // 10초마다 갱신
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="text-center text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (!replication || !replication.configured) {
    return (
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">🔄 리플리케이션 모니터링</h3>
        <div className="text-center text-gray-400 py-8">
          리플리케이션이 구성되지 않았거나 이 서버는 Primary 서버가 아닙니다.
        </div>
      </div>
    );
  }

  const { replicas } = replication;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">🔄 리플리케이션 모니터링</h3>
          <p className="text-sm text-gray-400 mt-1">
            {replicas.length}개의 Standby 서버 감지됨
          </p>
        </div>
        <div className="text-xs text-gray-500">10초마다 자동 갱신</div>
      </div>

      <div className="space-y-4">
        {replicas.map((replica: any, index: number) => {
          const replayLagSec = parseFloat(replica.replay_lag_seconds || 0);
          const isLagging = replayLagSec > 10;
          const isCritical = replayLagSec > 60;

          return (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                isCritical
                  ? 'bg-red-900/20 border-red-500/50'
                  : isLagging
                  ? 'bg-yellow-900/20 border-yellow-500/50'
                  : 'bg-dark-700/50 border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-white font-medium">
                    {replica.application_name || 'Unknown'}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {replica.client_addr || 'N/A'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      replica.state === 'streaming'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-gray-500/20 text-gray-300'
                    }`}
                  >
                    {replica.state}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      replica.sync_state === 'sync'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-purple-500/20 text-purple-300'
                    }`}
                  >
                    {replica.sync_state}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Replay Lag</div>
                  <div
                    className={`font-mono ${
                      isCritical
                        ? 'text-red-400 font-bold'
                        : isLagging
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}
                  >
                    {replayLagSec.toFixed(2)}s
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Write Lag</div>
                  <div className="text-gray-300 font-mono">
                    {replica.write_lag_seconds
                      ? parseFloat(replica.write_lag_seconds).toFixed(2) + 's'
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Flush Lag</div>
                  <div className="text-gray-300 font-mono">
                    {replica.flush_lag_seconds
                      ? parseFloat(replica.flush_lag_seconds).toFixed(2) + 's'
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Uptime</div>
                  <div className="text-gray-300 font-mono">
                    {(parseFloat(replica.uptime_seconds) / 3600).toFixed(1)}h
                  </div>
                </div>
              </div>

              {isCritical && (
                <div className="mt-3 p-2 bg-red-950/50 border border-red-500/30 rounded">
                  <p className="text-xs text-red-200">
                    🚨 <strong>심각:</strong> Replay Lag이 60초를 초과했습니다. 즉시 조치가 필요합니다.
                  </p>
                </div>
              )}
              {isLagging && !isCritical && (
                <div className="mt-3 p-2 bg-yellow-950/50 border border-yellow-500/30 rounded">
                  <p className="text-xs text-yellow-200">
                    ⚠️ <strong>경고:</strong> Replay Lag이 10초를 초과했습니다.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
