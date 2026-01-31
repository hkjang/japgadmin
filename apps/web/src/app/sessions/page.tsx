'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionApi, lockApi, inventoryApi } from '@/lib/api';

export default function SessionsPage() {
  const [selectedInstance, setSelectedInstance] = useState<string>('');

  const { data: instances = [] } = useQuery({
    queryKey: ['instances'],
    queryFn: () => inventoryApi.getInstances().then((r) => r.data.instances || []),
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">세션 관리</h1>
          <p className="text-gray-400 mt-1">활성 세션 모니터링 및 관리</p>
        </div>
        <select
          value={selectedInstance}
          onChange={(e) => setSelectedInstance(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="">인스턴스 선택</option>
          {instances.map((instance: any) => (
            <option key={instance.id} value={instance.id}>
              {instance.name} ({instance.host}:{instance.port})
            </option>
          ))}
        </select>
      </div>

      {selectedInstance ? (
        <SessionsContent instanceId={selectedInstance} />
      ) : (
        <div className="glass-card p-12 text-center">
          <p className="text-gray-400">세션을 조회할 인스턴스를 선택하세요</p>
        </div>
      )}
    </div>
  );
}

function SessionsContent({ instanceId }: { instanceId: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'sessions' | 'locks' | 'blocking'>('sessions');

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', instanceId],
    queryFn: () => sessionApi.getSessions(instanceId).then((r) => r.data),
    refetchInterval: 5000,
  });

  const { data: locksData, isLoading: locksLoading } = useQuery({
    queryKey: ['locks', instanceId],
    queryFn: () => lockApi.getLocks(instanceId).then((r) => r.data),
    refetchInterval: 5000,
    enabled: activeTab === 'locks',
  });

  const { data: blockingTree } = useQuery({
    queryKey: ['blocking-tree', instanceId],
    queryFn: () => lockApi.getBlockingTree(instanceId).then((r) => r.data),
    refetchInterval: 5000,
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

  const sessions = sessionsData?.sessions || [];
  const summary = sessionsData?.summary || {};
  const locks = locksData?.locks || [];

  const getStateColor = (state: string) => {
    switch (state) {
      case 'active':
        return 'text-green-400';
      case 'idle':
        return 'text-gray-400';
      case 'idle in transaction':
        return 'text-yellow-400';
      case 'idle in transaction (aborted)':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-sm text-gray-400">총 연결</p>
          <p className="text-2xl font-bold text-white">{summary.total || 0}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-gray-400">활성</p>
          <p className="text-2xl font-bold text-green-400">{summary.active || 0}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-gray-400">유휴</p>
          <p className="text-2xl font-bold text-gray-400">{summary.idle || 0}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-gray-400">대기 중</p>
          <p className="text-2xl font-bold text-yellow-400">{summary.waiting || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'sessions'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          세션 ({sessions.length})
        </button>
        <button
          onClick={() => setActiveTab('locks')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'locks'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          잠금
        </button>
        <button
          onClick={() => setActiveTab('blocking')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'blocking'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          블로킹 트리
        </button>
      </div>

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="glass-card overflow-hidden">
          {sessionsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-postgres-500"></div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">PID</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">사용자</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">상태</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">DB</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">쿼리</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">실행시간</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">작업</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session: any) => (
                  <tr key={session.pid} className="border-t border-gray-800">
                    <td className="px-4 py-3 text-white font-mono">{session.pid}</td>
                    <td className="px-4 py-3 text-gray-300">{session.usename}</td>
                    <td className={`px-4 py-3 ${getStateColor(session.state)}`}>
                      {session.state}
                      {session.waitEvent && (
                        <span className="text-xs text-yellow-400 ml-2">
                          ({session.waitEvent})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{session.datname}</td>
                    <td className="px-4 py-3 max-w-md">
                      <p className="text-gray-300 text-sm truncate" title={session.query}>
                        {session.query || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {session.durationSeconds ? `${session.durationSeconds}s` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => cancelMutation.mutate(session.pid)}
                          disabled={cancelMutation.isPending}
                          className="px-2 py-1 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('세션을 종료하시겠습니까?')) {
                              terminateMutation.mutate(session.pid);
                            }
                          }}
                          disabled={terminateMutation.isPending}
                          className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                        >
                          종료
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Locks Tab */}
      {activeTab === 'locks' && (
        <div className="glass-card overflow-hidden">
          {locksLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-postgres-500"></div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">PID</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">잠금 타입</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">모드</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">부여됨</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">대상</th>
                </tr>
              </thead>
              <tbody>
                {locks.map((lock: any, idx: number) => (
                  <tr key={idx} className="border-t border-gray-800">
                    <td className="px-4 py-3 text-white font-mono">{lock.pid}</td>
                    <td className="px-4 py-3 text-gray-300">{lock.locktype}</td>
                    <td className="px-4 py-3 text-gray-300">{lock.mode}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          lock.granted
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {lock.granted ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {lock.relation || lock.transactionid || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Blocking Tree Tab */}
      {activeTab === 'blocking' && (
        <div className="glass-card p-4">
          {blockingTree?.tree?.length > 0 ? (
            <div className="space-y-2">
              {blockingTree.tree.map((node: any, idx: number) => (
                <BlockingNode key={idx} node={node} level={0} />
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">현재 블로킹 관계가 없습니다</p>
          )}
        </div>
      )}
    </div>
  );
}

function BlockingNode({ node, level }: { node: any; level: number }) {
  return (
    <div style={{ marginLeft: `${level * 24}px` }}>
      <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded">
        <span className="text-white font-mono">PID: {node.pid}</span>
        <span className="text-gray-400">|</span>
        <span className="text-gray-300">{node.usename}</span>
        <span className="text-gray-400">|</span>
        <span className="text-xs text-gray-500 truncate max-w-md">{node.query}</span>
      </div>
      {node.blocked?.map((child: any, idx: number) => (
        <BlockingNode key={idx} node={child} level={level + 1} />
      ))}
    </div>
  );
}
