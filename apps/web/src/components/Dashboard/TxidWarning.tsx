'use client';

import { useEffect, useState } from 'react';
import { monitoringApi } from '@/lib/api';

export default function TxidWarning() {
  const [txidData, setTxidData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await monitoringApi.getTxidWraparound();
        setTxidData(res.data.data);
      } catch (error) {
        console.error('Failed to fetch txid data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // 30초마다
    return () => clearInterval(interval);
  }, []);

  if (loading || !txidData) return null;

  const percent = parseFloat(txidData.percent_towards_wraparound);
  const isWarning = percent > 50;
  const isCritical = percent > 75;

  if (!isWarning) return null; // 50% 미만이면 표시 안 함

  return (
    <div className={`glass-card p-6 border-l-4 ${isCritical ? 'border-red-500' : 'border-yellow-500'}`}>
      <div className="flex items-start gap-4">
        <div className="text-4xl">{isCritical ? '🚨' : '⚠️'}</div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-2">
            {isCritical ? 'Transaction ID Wraparound 긴급 경고!' : 'Transaction ID Wraparound 주의'}
          </h3>
          <p className="text-sm text-gray-300 mb-4">
            데이터베이스가 Transaction ID Wraparound에 근접하고 있습니다. 즉시 VACUUM FREEZE 작업이 필요할 수 있습니다.
          </p>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">진행률</span>
              <span className={`font-mono font-bold ${isCritical ? 'text-red-400' : 'text-yellow-400'}`}>
                {percent}%
              </span>
            </div>
            <div className="w-full bg-dark-700 rounded-full h-3 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isCritical 
                    ? 'bg-gradient-to-r from-red-600 to-red-500' 
                    : 'bg-gradient-to-r from-yellow-600 to-yellow-500'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
              <div>
                <div className="text-gray-500">Transaction ID Age</div>
                <div className="font-mono text-white">{parseInt(txidData.xid_age).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">남은 Transaction IDs</div>
                <div className="font-mono text-white">{parseInt(txidData.xids_remaining).toLocaleString()}</div>
              </div>
            </div>
          </div>

          {isCritical && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded">
              <p className="text-xs text-red-200">
                <strong>권장 조치:</strong> 즉시 <code className="bg-red-950 px-1 py-0.5 rounded">VACUUM FREEZE</code> 실행을 고려하세요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
