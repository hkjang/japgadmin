'use client';

import { useEffect, useState } from 'react';
import { monitoringApi } from '@/lib/api';

export default function LocksMonitor() {
  const [locks, setLocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await monitoringApi.getLocks();
        setLocks(res.data.locks || []);
      } catch (error) {
        console.error('Failed to fetch locks data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // 10초마다
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="text-center text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (locks.length === 0) {
    return (
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">🔒 Lock 모니터링</h3>
        <div className="text-center text-gray-400 py-8">
          현재 대기 중이거나 차단된 Lock이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">🔒 Lock 모니터링</h3>
          <p className="text-sm text-gray-400 mt-1">현재 {locks.length}개의 Lock 감지됨</p>
        </div>
        <div className="text-xs text-gray-500">10초마다 자동 갱신</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-400 font-medium">PID</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">사용자</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Lock 유형</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">모드</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">상태</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">소요 시간</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">쿼리</th>
            </tr>
          </thead>
          <tbody>
            {locks.map((lock, index) => (
              <tr 
                key={index}
                className="border-b border-gray-800 hover:bg-dark-700/50 transition-colors"
              >
                <td className="py-3 px-4 font-mono text-white">{lock.pid}</td>
                <td className="py-3 px-4 text-gray-300">{lock.usename || '-'}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-300">
                    {lock.locktype}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-300">{lock.mode}</td>
                <td className="py-3 px-4">
                  {lock.granted ? (
                    <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-300">
                      승인됨
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-300 animate-pulse">
                      대기 중
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-gray-300 font-mono">
                  {lock.duration_seconds ? `${parseFloat(lock.duration_seconds).toFixed(2)}s` : '-'}
                </td>
                <td className="py-3 px-4 text-gray-400 max-w-md truncate" title={lock.query}>
                  {lock.query || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {locks.some(lock => !lock.granted) && (
        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded">
          <p className="text-sm text-yellow-200">
            ⚠️ <strong>경고:</strong> 대기 중인 Lock이 있습니다. 장시간 대기하는 경우 성능 문제가 발생할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
