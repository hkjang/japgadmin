'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionApi, lockApi, inventoryApi } from '@/lib/api';

type TabType = 'sessions' | 'locks' | 'blocking' | 'deadlocks';
type SessionFilter = 'all' | 'active' | 'idle' | 'idle_in_tx' | 'waiting';
type SortField = 'pid' | 'duration' | 'state' | 'user';

interface Session {
  pid: number;
  usename: string;
  datname: string;
  state: string;
  query: string;
  queryStart?: string;
  stateChange?: string;
  waitEvent?: string;
  waitEventType?: string;
  clientAddr?: string;
  clientPort?: number;
  applicationName?: string;
  backendStart?: string;
  xactStart?: string;
  durationSeconds?: number;
  durationMs?: number;
}

interface Lock {
  pid: number;
  locktype: string;
  mode: string;
  granted: boolean;
  relation?: string;
  transactionid?: string;
  database?: string;
  page?: number;
  tuple?: number;
  virtualxid?: string;
  objid?: string;
}

export default function SessionsPage() {
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  const { data: instances = [] } = useQuery({
    queryKey: ['instances'],
    queryFn: () => inventoryApi.getInstances().then((r) => r.data.instances || []),
  });

  const onlineInstances = instances.filter((i: any) => i.status === 'ONLINE');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">세션 관리</h1>
          <p className="text-gray-400 mt-1">활성 세션 모니터링 및 관리</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Auto Refresh Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoRefresh ? 'bg-postgres-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-400">자동 새로고침</span>
          </div>

          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
              className="px-3 py-1.5 bg-dark-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-postgres-500"
            >
              <option value={3000}>3초</option>
              <option value={5000}>5초</option>
              <option value={10000}>10초</option>
              <option value={30000}>30초</option>
            </select>
          )}

          {/* Instance Selector */}
          <select
            value={selectedInstance}
            onChange={(e) => setSelectedInstance(e.target.value)}
            className="px-4 py-2 bg-dark-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-postgres-500"
          >
            <option value="">인스턴스 선택</option>
            {onlineInstances.map((instance: any) => (
              <option key={instance.id} value={instance.id}>
                {instance.name} ({instance.host}:{instance.port})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedInstance ? (
        <SessionsContent
          instanceId={selectedInstance}
          autoRefresh={autoRefresh}
          refreshInterval={refreshInterval}
        />
      ) : (
        <div className="glass-card p-16 text-center">
          <div className="text-6xl mb-4">👥</div>
          <p className="text-xl text-gray-300 mb-2">인스턴스를 선택하세요</p>
          <p className="text-gray-500">세션을 조회할 PostgreSQL 인스턴스를 선택해주세요</p>
          {onlineInstances.length === 0 && instances.length > 0 && (
            <p className="text-yellow-400 mt-4 text-sm">⚠️ 온라인 인스턴스가 없습니다</p>
          )}
        </div>
      )}
    </div>
  );
}

function SessionsContent({
  instanceId,
  autoRefresh,
  refreshInterval,
}: {
  instanceId: string;
  autoRefresh: boolean;
  refreshInterval: number;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const [filter, setFilter] = useState<SessionFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('duration');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [expandedBlocking, setExpandedBlocking] = useState<Set<number>>(new Set());

  const { data: sessionsData, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions', instanceId],
    queryFn: () => sessionApi.getSessions(instanceId).then((r) => r.data),
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const { data: locksData, isLoading: locksLoading } = useQuery({
    queryKey: ['locks', instanceId],
    queryFn: () => lockApi.getLocks(instanceId).then((r) => r.data),
    refetchInterval: autoRefresh ? refreshInterval : false,
    enabled: activeTab === 'locks',
  });

  const { data: blockingTree } = useQuery({
    queryKey: ['blocking-tree', instanceId],
    queryFn: () => lockApi.getBlockingTree(instanceId).then((r) => r.data),
    refetchInterval: autoRefresh ? refreshInterval : false,
    enabled: activeTab === 'blocking',
  });

  const cancelMutation = useMutation({
    mutationFn: (pid: number) => sessionApi.cancelQuery(instanceId, pid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', instanceId] });
    },
  });

  const terminateMutation = useMutation({
    mutationFn: (pid: number) => sessionApi.terminateSession(instanceId, pid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', instanceId] });
    },
  });

  const sessions: Session[] = sessionsData?.sessions || [];
  const summary = sessionsData?.summary || {};
  const locks: Lock[] = locksData?.locks || [];

  // 추가 통계 계산
  const stats = useMemo(() => {
    const idleInTx = sessions.filter((s) => s.state?.startsWith('idle in transaction')).length;
    const waiting = sessions.filter((s) => s.waitEvent).length;
    const longRunning = sessions.filter((s) => (s.durationSeconds || 0) > 60).length;
    return {
      total: summary.total || sessions.length,
      active: summary.active || sessions.filter((s) => s.state === 'active').length,
      idle: summary.idle || sessions.filter((s) => s.state === 'idle').length,
      idleInTx,
      waiting,
      longRunning,
    };
  }, [sessions, summary]);

  // 필터링 및 정렬
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // 상태 필터
    if (filter === 'active') {
      result = result.filter((s) => s.state === 'active');
    } else if (filter === 'idle') {
      result = result.filter((s) => s.state === 'idle');
    } else if (filter === 'idle_in_tx') {
      result = result.filter((s) => s.state?.startsWith('idle in transaction'));
    } else if (filter === 'waiting') {
      result = result.filter((s) => s.waitEvent);
    }

    // 검색 필터
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.pid.toString().includes(search) ||
          s.usename?.toLowerCase().includes(search) ||
          s.datname?.toLowerCase().includes(search) ||
          s.query?.toLowerCase().includes(search) ||
          s.applicationName?.toLowerCase().includes(search) ||
          s.clientAddr?.toLowerCase().includes(search)
      );
    }

    // 정렬
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'pid':
          aVal = a.pid;
          bVal = b.pid;
          break;
        case 'duration':
          aVal = a.durationSeconds || 0;
          bVal = b.durationSeconds || 0;
          break;
        case 'state':
          aVal = a.state || '';
          bVal = b.state || '';
          break;
        case 'user':
          aVal = a.usename || '';
          bVal = b.usename || '';
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDesc ? 1 : -1;
      if (aVal > bVal) return sortDesc ? -1 : 1;
      return 0;
    });

    return result;
  }, [sessions, filter, searchTerm, sortField, sortDesc]);

  // 데드락 관련 세션 (대기 중인 Lock을 가진 세션)
  const potentialDeadlocks = useMemo(() => {
    const waitingLocks = locks.filter((l) => !l.granted);
    const waitingPids = new Set(waitingLocks.map((l) => l.pid));
    return sessions.filter((s) => waitingPids.has(s.pid));
  }, [locks, sessions]);

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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const getDurationColor = (seconds?: number) => {
    if (!seconds) return 'text-gray-400';
    if (seconds > 300) return 'text-red-400';
    if (seconds > 60) return 'text-yellow-400';
    return 'text-gray-300';
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  const toggleBlockingExpand = (pid: number) => {
    setExpandedBlocking((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pid)) {
        newSet.delete(pid);
      } else {
        newSet.add(pid);
      }
      return newSet;
    });
  };

  const tabs = [
    { id: 'sessions' as const, label: '세션', icon: '👥', count: stats.total },
    { id: 'locks' as const, label: '잠금', icon: '🔒', count: locks.length },
    { id: 'blocking' as const, label: '블로킹 트리', icon: '🌳', count: blockingTree?.tree?.length || 0 },
    { id: 'deadlocks' as const, label: '데드락 위험', icon: '⚠️', count: potentialDeadlocks.length },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="총 연결"
          value={stats.total}
          icon="🔗"
          color="text-blue-400"
          bgColor="bg-blue-500/10"
        />
        <StatCard
          label="활성"
          value={stats.active}
          icon="▶️"
          color="text-emerald-400"
          bgColor="bg-emerald-500/10"
        />
        <StatCard
          label="유휴"
          value={stats.idle}
          icon="⏸️"
          color="text-gray-400"
          bgColor="bg-gray-500/10"
        />
        <StatCard
          label="트랜잭션 유휴"
          value={stats.idleInTx}
          icon="⏳"
          color={stats.idleInTx > 0 ? 'text-yellow-400' : 'text-gray-400'}
          bgColor={stats.idleInTx > 0 ? 'bg-yellow-500/10' : 'bg-gray-500/10'}
          warning={stats.idleInTx > 5}
        />
        <StatCard
          label="대기 중"
          value={stats.waiting}
          icon="🔄"
          color={stats.waiting > 0 ? 'text-orange-400' : 'text-gray-400'}
          bgColor={stats.waiting > 0 ? 'bg-orange-500/10' : 'bg-gray-500/10'}
        />
        <StatCard
          label="장시간 실행"
          value={stats.longRunning}
          icon="⏱️"
          color={stats.longRunning > 0 ? 'text-red-400' : 'text-gray-400'}
          bgColor={stats.longRunning > 0 ? 'bg-red-500/10' : 'bg-gray-500/10'}
          warning={stats.longRunning > 0}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-800/50 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-postgres-600 text-white shadow-lg shadow-postgres-600/30'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-dark-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="glass-card overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Filter Tabs */}
            <div className="flex gap-1 bg-dark-800 p-1 rounded-lg">
              {[
                { key: 'all', label: '전체', count: stats.total },
                { key: 'active', label: '활성', count: stats.active },
                { key: 'idle', label: '유휴', count: stats.idle },
                { key: 'idle_in_tx', label: '트랜잭션', count: stats.idleInTx },
                { key: 'waiting', label: '대기', count: stats.waiting },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as SessionFilter)}
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

            {/* Search & Actions */}
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="PID, 사용자, DB, 쿼리 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 px-3 py-1.5 bg-dark-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-postgres-500"
              />
              <button
                onClick={() => refetchSessions()}
                className="p-2 text-gray-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                title="새로고침"
              >
                🔄
              </button>
            </div>
          </div>

          {/* Table */}
          {sessionsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-postgres-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-dark-800 text-gray-400 text-xs uppercase">
                  <tr>
                    <th
                      className="px-4 py-3 font-medium cursor-pointer hover:text-white"
                      onClick={() => handleSort('pid')}
                    >
                      PID {sortField === 'pid' && (sortDesc ? '↓' : '↑')}
                    </th>
                    <th
                      className="px-4 py-3 font-medium cursor-pointer hover:text-white"
                      onClick={() => handleSort('user')}
                    >
                      사용자 {sortField === 'user' && (sortDesc ? '↓' : '↑')}
                    </th>
                    <th className="px-4 py-3 font-medium">DB</th>
                    <th className="px-4 py-3 font-medium">애플리케이션</th>
                    <th
                      className="px-4 py-3 font-medium cursor-pointer hover:text-white"
                      onClick={() => handleSort('state')}
                    >
                      상태 {sortField === 'state' && (sortDesc ? '↓' : '↑')}
                    </th>
                    <th className="px-4 py-3 font-medium">대기 이벤트</th>
                    <th
                      className="px-4 py-3 font-medium cursor-pointer hover:text-white"
                      onClick={() => handleSort('duration')}
                    >
                      실행시간 {sortField === 'duration' && (sortDesc ? '↓' : '↑')}
                    </th>
                    <th className="px-4 py-3 font-medium">쿼리</th>
                    <th className="px-4 py-3 font-medium">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredSessions.map((session) => (
                    <tr
                      key={session.pid}
                      className="hover:bg-dark-700/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedSession(session)}
                    >
                      <td className="px-4 py-3 font-mono text-blue-400">{session.pid}</td>
                      <td className="px-4 py-3 text-gray-300">{session.usename || '-'}</td>
                      <td className="px-4 py-3 text-gray-400">{session.datname || '-'}</td>
                      <td className="px-4 py-3 text-gray-400 max-w-[120px] truncate" title={session.applicationName}>
                        {session.applicationName || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded border ${getStateColor(session.state)}`}>
                          {session.state || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {session.waitEvent ? (
                          <span className="px-2 py-0.5 text-xs rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            {session.waitEventType}: {session.waitEvent}
                          </span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 font-mono ${getDurationColor(session.durationSeconds)}`}>
                        {formatDuration(session.durationSeconds)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 max-w-[200px] truncate" title={session.query}>
                            {session.query || '-'}
                          </span>
                          {session.query && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(session.query);
                              }}
                              className="p-1 text-gray-500 hover:text-white flex-shrink-0"
                              title="쿼리 복사"
                            >
                              📋
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => cancelMutation.mutate(session.pid)}
                            disabled={cancelMutation.isPending}
                            className="px-2 py-1 text-xs bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded transition-colors"
                            title="쿼리 취소"
                          >
                            취소
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`PID ${session.pid} 세션을 종료하시겠습니까?`)) {
                                terminateMutation.mutate(session.pid);
                              }
                            }}
                            disabled={terminateMutation.isPending}
                            className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded transition-colors"
                            title="세션 종료"
                          >
                            종료
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSessions.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        {searchTerm || filter !== 'all' ? '검색 결과가 없습니다' : '활성 세션이 없습니다'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {filteredSessions.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-500">
              {filter !== 'all' || searchTerm
                ? `${filteredSessions.length}개 표시 (전체 ${stats.total}개)`
                : `전체 ${stats.total}개 세션`}
            </div>
          )}
        </div>
      )}

      {/* Locks Tab */}
      {activeTab === 'locks' && (
        <div className="glass-card overflow-hidden">
          <div className="glass-header p-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">활성 잠금</h3>
              <p className="text-sm text-gray-400">{locks.length}개 잠금</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-400">
                부여됨: {locks.filter((l) => l.granted).length}
              </span>
              <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400">
                대기 중: {locks.filter((l) => !l.granted).length}
              </span>
            </div>
          </div>

          {locksLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-postgres-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-dark-800 text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">PID</th>
                    <th className="px-4 py-3 font-medium">잠금 타입</th>
                    <th className="px-4 py-3 font-medium">모드</th>
                    <th className="px-4 py-3 font-medium">상태</th>
                    <th className="px-4 py-3 font-medium">대상</th>
                    <th className="px-4 py-3 font-medium">트랜잭션 ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {locks.map((lock, idx) => (
                    <tr key={idx} className="hover:bg-dark-700/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-blue-400">{lock.pid}</td>
                      <td className="px-4 py-3 text-gray-300">{lock.locktype}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          lock.mode.includes('Exclusive')
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {lock.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            lock.granted
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400 animate-pulse'
                          }`}
                        >
                          {lock.granted ? '부여됨' : '대기 중'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {lock.relation || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-sm">
                        {lock.transactionid || lock.virtualxid || '-'}
                      </td>
                    </tr>
                  ))}
                  {locks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        활성 잠금이 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Blocking Tree Tab */}
      {activeTab === 'blocking' && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">블로킹 트리</h3>
              <p className="text-sm text-gray-400">세션 간 블로킹 관계를 시각화합니다</p>
            </div>
            {blockingTree?.tree?.length > 0 && (
              <button
                onClick={() => {
                  const allPids = new Set<number>();
                  const collectPids = (nodes: any[]) => {
                    nodes.forEach((n) => {
                      allPids.add(n.pid);
                      if (n.blocked) collectPids(n.blocked);
                    });
                  };
                  collectPids(blockingTree.tree);
                  setExpandedBlocking(allPids);
                }}
                className="px-3 py-1.5 text-sm bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg transition-colors"
              >
                모두 펼치기
              </button>
            )}
          </div>

          {blockingTree?.tree?.length > 0 ? (
            <div className="space-y-3">
              {blockingTree.tree.map((node: any, idx: number) => (
                <BlockingNode
                  key={idx}
                  node={node}
                  level={0}
                  expanded={expandedBlocking}
                  onToggle={toggleBlockingExpand}
                  onTerminate={(pid) => {
                    if (confirm(`PID ${pid} 세션을 종료하시겠습니까?`)) {
                      terminateMutation.mutate(pid);
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-xl text-gray-300 mb-2">블로킹 없음</p>
              <p className="text-gray-500">현재 블로킹 관계가 없습니다</p>
            </div>
          )}
        </div>
      )}

      {/* Deadlocks Tab */}
      {activeTab === 'deadlocks' && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">데드락 위험 감지</h3>
              <p className="text-sm text-gray-400">잠금을 대기 중인 세션을 모니터링합니다</p>
            </div>
            {potentialDeadlocks.length > 0 && (
              <span className="px-3 py-1 text-sm rounded bg-red-500/20 text-red-400 border border-red-500/30">
                {potentialDeadlocks.length}개 위험 세션
              </span>
            )}
          </div>

          {potentialDeadlocks.length > 0 ? (
            <div className="space-y-4">
              {potentialDeadlocks.map((session) => {
                const sessionLocks = locks.filter((l) => l.pid === session.pid);
                const waitingFor = sessionLocks.filter((l) => !l.granted);

                return (
                  <div key={session.pid} className="p-4 bg-dark-700/50 rounded-lg border border-red-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                          <span className="font-mono text-blue-400">PID: {session.pid}</span>
                          <span className="text-gray-400 mx-2">|</span>
                          <span className="text-gray-300">{session.usename}</span>
                          <span className="text-gray-400 mx-2">|</span>
                          <span className="text-gray-400">{session.datname}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => cancelMutation.mutate(session.pid)}
                          className="px-3 py-1 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors"
                        >
                          쿼리 취소
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`PID ${session.pid} 세션을 종료하시겠습니까?`)) {
                              terminateMutation.mutate(session.pid);
                            }
                          }}
                          className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        >
                          세션 종료
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-500">실행 시간:</span>
                        <span className={`ml-2 ${getDurationColor(session.durationSeconds)}`}>
                          {formatDuration(session.durationSeconds)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">대기 이벤트:</span>
                        <span className="ml-2 text-orange-400">
                          {session.waitEventType}: {session.waitEvent}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">대기 중인 잠금:</span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {waitingFor.map((lock, idx) => (
                            <span key={idx} className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400">
                              {lock.locktype} / {lock.mode}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">쿼리:</span>
                        <pre className="mt-1 p-2 bg-dark-800 rounded text-gray-300 text-xs overflow-x-auto">
                          {session.query || '-'}
                        </pre>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-xl text-gray-300 mb-2">데드락 위험 없음</p>
              <p className="text-gray-500">현재 잠금을 대기 중인 세션이 없습니다</p>
            </div>
          )}
        </div>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onCancel={() => cancelMutation.mutate(selectedSession.pid)}
          onTerminate={() => {
            if (confirm(`PID ${selectedSession.pid} 세션을 종료하시겠습니까?`)) {
              terminateMutation.mutate(selectedSession.pid);
              setSelectedSession(null);
            }
          }}
          getStateColor={getStateColor}
          formatDuration={formatDuration}
          getDurationColor={getDurationColor}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  bgColor,
  warning,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  bgColor: string;
  warning?: boolean;
}) {
  return (
    <div className={`glass-card p-4 ${bgColor} relative overflow-hidden`}>
      {warning && (
        <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse m-2" />
      )}
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function BlockingNode({
  node,
  level,
  expanded,
  onToggle,
  onTerminate,
}: {
  node: any;
  level: number;
  expanded: Set<number>;
  onToggle: (pid: number) => void;
  onTerminate: (pid: number) => void;
}) {
  const hasChildren = node.blocked && node.blocked.length > 0;
  const isExpanded = expanded.has(node.pid);
  const isBlocker = level === 0;

  return (
    <div className={level > 0 ? 'ml-8 border-l-2 border-gray-700 pl-4' : ''}>
      <div
        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
          isBlocker
            ? 'bg-red-900/20 border border-red-500/30'
            : 'bg-dark-700/50 border border-gray-700'
        }`}
      >
        {hasChildren && (
          <button
            onClick={() => onToggle(node.pid)}
            className="p-1 text-gray-400 hover:text-white"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <span className="w-6" />}

        <span className={`text-lg ${isBlocker ? '🔴' : '🟡'}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-blue-400">PID: {node.pid}</span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-300">{node.usename || '-'}</span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">{node.datname || '-'}</span>
            {node.durationSeconds && (
              <>
                <span className="text-gray-500">|</span>
                <span className="text-yellow-400">{node.durationSeconds}s</span>
              </>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 truncate" title={node.query}>
            {node.query || '-'}
          </p>
        </div>

        <button
          onClick={() => onTerminate(node.pid)}
          className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
        >
          종료
        </button>
      </div>

      {hasChildren && isExpanded && (
        <div className="mt-2 space-y-2">
          {node.blocked.map((child: any, idx: number) => (
            <BlockingNode
              key={idx}
              node={child}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
              onTerminate={onTerminate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionDetailModal({
  session,
  onClose,
  onCancel,
  onTerminate,
  getStateColor,
  formatDuration,
  getDurationColor,
}: {
  session: Session;
  onClose: () => void;
  onCancel: () => void;
  onTerminate: () => void;
  getStateColor: (state: string) => string;
  formatDuration: (seconds?: number) => string;
  getDurationColor: (seconds?: number) => string;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="glass-header p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👤</span>
            <div>
              <h3 className="text-lg font-semibold text-white">세션 상세 정보</h3>
              <p className="text-sm text-gray-400">PID: {session.pid}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InfoItem label="PID" value={session.pid} mono />
            <InfoItem label="사용자" value={session.usename || '-'} />
            <InfoItem label="데이터베이스" value={session.datname || '-'} />
            <InfoItem label="애플리케이션" value={session.applicationName || '-'} />
            <InfoItem label="클라이언트 IP" value={session.clientAddr || '-'} mono />
            <InfoItem label="클라이언트 포트" value={session.clientPort || '-'} mono />
          </div>

          {/* Status */}
          <div className="p-4 bg-dark-700/50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-400 mb-3">상태</h4>
            <div className="flex flex-wrap gap-4">
              <div>
                <span className="text-xs text-gray-500">세션 상태</span>
                <div className="mt-1">
                  <span className={`px-2 py-1 text-sm rounded border ${getStateColor(session.state)}`}>
                    {session.state || '-'}
                  </span>
                </div>
              </div>
              {session.waitEvent && (
                <div>
                  <span className="text-xs text-gray-500">대기 이벤트</span>
                  <div className="mt-1">
                    <span className="px-2 py-1 text-sm rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      {session.waitEventType}: {session.waitEvent}
                    </span>
                  </div>
                </div>
              )}
              <div>
                <span className="text-xs text-gray-500">실행 시간</span>
                <div className={`mt-1 text-lg font-mono ${getDurationColor(session.durationSeconds)}`}>
                  {formatDuration(session.durationSeconds)}
                </div>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="p-4 bg-dark-700/50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-400 mb-3">타임스탬프</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {session.backendStart && (
                <div>
                  <span className="text-gray-500">백엔드 시작:</span>
                  <span className="ml-2 text-gray-300">{new Date(session.backendStart).toLocaleString('ko-KR')}</span>
                </div>
              )}
              {session.xactStart && (
                <div>
                  <span className="text-gray-500">트랜잭션 시작:</span>
                  <span className="ml-2 text-gray-300">{new Date(session.xactStart).toLocaleString('ko-KR')}</span>
                </div>
              )}
              {session.queryStart && (
                <div>
                  <span className="text-gray-500">쿼리 시작:</span>
                  <span className="ml-2 text-gray-300">{new Date(session.queryStart).toLocaleString('ko-KR')}</span>
                </div>
              )}
              {session.stateChange && (
                <div>
                  <span className="text-gray-500">상태 변경:</span>
                  <span className="ml-2 text-gray-300">{new Date(session.stateChange).toLocaleString('ko-KR')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Query */}
          <div className="p-4 bg-dark-700/50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-400">현재 쿼리</h4>
              {session.query && (
                <button
                  onClick={() => navigator.clipboard.writeText(session.query)}
                  className="px-2 py-1 text-xs bg-dark-600 hover:bg-dark-500 text-gray-300 rounded transition-colors"
                >
                  📋 복사
                </button>
              )}
            </div>
            <pre className="p-3 bg-dark-800 rounded text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">
              {session.query || '실행 중인 쿼리가 없습니다'}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
          >
            닫기
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
          >
            쿼리 취소
          </button>
          <button
            onClick={onTerminate}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            세션 종료
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <p className={`text-gray-300 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
