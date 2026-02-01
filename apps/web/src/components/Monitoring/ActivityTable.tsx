'use client';

import { useState } from 'react';

interface Activity {
  pid: number;
  usename: string;
  application_name: string;
  client_addr?: string;
  state: string;
  query: string;
  duration_seconds?: number;
  duration_ms?: number;
  wait_event_type?: string;
  wait_event?: string;
}

interface ActivityTableProps {
  data: Activity[];
  onRefresh?: () => void;
}

export default function ActivityTable({ data, onRefresh }: ActivityTableProps) {
  const [expandedQuery, setExpandedQuery] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'idle' | 'waiting'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const formatDuration = (row: Activity) => {
    const seconds = row.duration_seconds ?? (row.duration_ms ? row.duration_ms / 1000 : undefined);
    if (!seconds) return '-';
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const getDurationSeconds = (row: Activity) => {
    return row.duration_seconds ?? (row.duration_ms ? row.duration_ms / 1000 : undefined);
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'active':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'idle':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'idle in transaction':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'idle in transaction (aborted)':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const getDurationColor = (seconds?: number) => {
    if (!seconds) return 'text-gray-400';
    if (seconds > 300) return 'text-red-400'; // 5분 이상
    if (seconds > 60) return 'text-yellow-400'; // 1분 이상
    return 'text-gray-300';
  };

  // 필터링
  const filteredData = data.filter((row) => {
    // 상태 필터
    if (filter === 'active' && row.state !== 'active') return false;
    if (filter === 'idle' && !row.state.startsWith('idle')) return false;
    if (filter === 'waiting' && !row.wait_event) return false;

    // 검색 필터
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        row.usename?.toLowerCase().includes(search) ||
        row.application_name?.toLowerCase().includes(search) ||
        row.query?.toLowerCase().includes(search) ||
        row.pid.toString().includes(search)
      );
    }

    return true;
  });

  // 통계
  const stats = {
    total: data.length,
    active: data.filter((r) => r.state === 'active').length,
    idle: data.filter((r) => r.state === 'idle').length,
    idleInTx: data.filter((r) => r.state.startsWith('idle in transaction')).length,
    waiting: data.filter((r) => r.wait_event).length,
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-4">
        {/* Filter Tabs */}
        <div className="flex gap-1 bg-dark-800 p-1 rounded-lg">
          {[
            { key: 'all', label: '전체', count: stats.total },
            { key: 'active', label: '활성', count: stats.active },
            { key: 'idle', label: '유휴', count: stats.idle + stats.idleInTx },
            { key: 'waiting', label: '대기', count: stats.waiting },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                filter === tab.key
                  ? 'bg-postgres-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="PID, 사용자, 쿼리 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 px-3 py-1.5 bg-dark-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-postgres-500"
          />
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-gray-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
              title="새로고침"
            >
              🔄
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-dark-800 text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">PID</th>
              <th className="px-4 py-3 font-medium">사용자</th>
              <th className="px-4 py-3 font-medium">애플리케이션</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3 font-medium">대기 이벤트</th>
              <th className="px-4 py-3 font-medium">소요 시간</th>
              <th className="px-4 py-3 font-medium">쿼리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredData.map((row) => (
              <tr
                key={row.pid}
                className="hover:bg-dark-700/50 transition-colors cursor-pointer"
                onClick={() => setExpandedQuery(expandedQuery === row.pid ? null : row.pid)}
              >
                <td className="px-4 py-3 font-mono text-blue-400">{row.pid}</td>
                <td className="px-4 py-3 text-gray-300">{row.usename || '-'}</td>
                <td className="px-4 py-3 text-gray-400 max-w-[150px] truncate" title={row.application_name}>
                  {row.application_name || '-'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded border ${getStateColor(row.state)}`}>
                    {row.state}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {row.wait_event ? (
                    <span className="px-2 py-0.5 text-xs rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      {row.wait_event_type}: {row.wait_event}
                    </span>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </td>
                <td className={`px-4 py-3 font-mono ${getDurationColor(getDurationSeconds(row))}`}>
                  {formatDuration(row)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-gray-400 max-w-[250px] truncate hover:text-white"
                      title={row.query}
                    >
                      {row.query || '-'}
                    </span>
                    {row.query && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(row.query);
                        }}
                        className="p-1 text-gray-500 hover:text-white flex-shrink-0"
                        title="쿼리 복사"
                      >
                        📋
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {searchTerm || filter !== 'all'
                    ? '검색 결과가 없습니다'
                    : '활성 세션이 없습니다'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Stats Footer */}
      {data.length > 0 && (
        <div className="flex gap-4 text-xs text-gray-500 px-4 pb-4 border-t border-gray-800 pt-3">
          <span>전체: {stats.total}</span>
          <span className="text-emerald-400">활성: {stats.active}</span>
          <span className="text-gray-400">유휴: {stats.idle}</span>
          {stats.idleInTx > 0 && <span className="text-yellow-400">트랜잭션 유휴: {stats.idleInTx}</span>}
          {stats.waiting > 0 && <span className="text-orange-400">대기 중: {stats.waiting}</span>}
        </div>
      )}
    </div>
  );
}
