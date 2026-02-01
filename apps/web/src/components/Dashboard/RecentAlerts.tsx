'use client';

import { useEffect, useState } from 'react';
import { monitoringApi } from '@/lib/api';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  time: Date;
}

export default function RecentAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [connRes, txidRes, locksRes] = await Promise.all([
          monitoringApi.getConnectionStats(),
          monitoringApi.getTxidWraparound(),
          monitoringApi.getLocks(),
        ]);

        const newAlerts: Alert[] = [];
        const now = new Date();

        // 연결 사용률 체크
        const usagePercent = parseFloat(connRes.data.connections?.usage_percentage || 0);
        if (usagePercent > 80) {
          newAlerts.push({
            id: 'conn-critical',
            type: 'critical',
            title: '연결 사용률 높음',
            message: `현재 연결 사용률이 ${usagePercent}%입니다.`,
            time: now,
          });
        } else if (usagePercent > 50) {
          newAlerts.push({
            id: 'conn-warning',
            type: 'warning',
            title: '연결 사용률 주의',
            message: `현재 연결 사용률이 ${usagePercent}%입니다.`,
            time: now,
          });
        }

        // 유휴 트랜잭션 체크
        const idleInTx = parseInt(connRes.data.connections?.idle_in_transaction || 0);
        if (idleInTx > 0) {
          newAlerts.push({
            id: 'idle-tx',
            type: idleInTx > 5 ? 'critical' : 'warning',
            title: '유휴 트랜잭션 감지',
            message: `${idleInTx}개의 유휴 상태 트랜잭션이 있습니다.`,
            time: now,
          });
        }

        // TXID Wraparound 체크
        const txidPercent = parseFloat(txidRes.data.data?.percent_towards_wraparound || 0);
        if (txidPercent > 50) {
          newAlerts.push({
            id: 'txid',
            type: txidPercent > 75 ? 'critical' : 'warning',
            title: 'Transaction ID 경고',
            message: `Wraparound까지 ${txidPercent.toFixed(1)}% 진행되었습니다.`,
            time: now,
          });
        }

        // 대기 Lock 체크
        const waitingLocks = locksRes.data.locks?.filter((l: any) => !l.granted) || [];
        if (waitingLocks.length > 0) {
          newAlerts.push({
            id: 'locks',
            type: 'warning',
            title: 'Lock 대기 감지',
            message: `${waitingLocks.length}개의 Lock이 대기 중입니다.`,
            time: now,
          });
        }

        // 모든 것이 정상이면
        if (newAlerts.length === 0) {
          newAlerts.push({
            id: 'all-ok',
            type: 'info',
            title: '시스템 정상',
            message: '모든 지표가 정상 범위 내에 있습니다.',
            time: now,
          });
        }

        setAlerts(newAlerts);
      } catch (error) {
        console.error('Failed to fetch alerts', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const getAlertStyle = (type: string) => {
    switch (type) {
      case 'critical':
        return {
          bg: 'bg-red-500/10 border-red-500/30',
          icon: '🚨',
          iconBg: 'bg-red-500/20',
          textColor: 'text-red-400',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-500/10 border-yellow-500/30',
          icon: '⚠️',
          iconBg: 'bg-yellow-500/20',
          textColor: 'text-yellow-400',
        };
      default:
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30',
          icon: '✅',
          iconBg: 'bg-emerald-500/20',
          textColor: 'text-emerald-400',
        };
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 bg-dark-600 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-dark-600 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">실시간 알림</h3>
        <span className="text-xs text-gray-500">
          {new Date().toLocaleTimeString('ko-KR')} 기준
        </span>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
        {alerts.map((alert) => {
          const style = getAlertStyle(alert.type);
          return (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border ${style.bg} transition-all hover:scale-[1.01]`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${style.iconBg}`}>
                  <span className="text-lg">{style.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${style.textColor}`}>
                    {alert.title}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {alert.message}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
