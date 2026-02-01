'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryConsoleApi, inventoryApi } from '@/lib/api';
import { SqlEditor } from '@/components/SqlEditor';
import { SqlDisplay } from '@/components/SqlDisplay';

interface QueryResult {
  success: boolean;
  columns?: string[];
  rows?: any[];
  rowCount?: number;
  executionTime?: number;
  error?: string;
  truncated?: boolean;
}

const QUICK_QUERIES: Record<string, { name: string; sql: string; description: string }[]> = {
  System: [
    {
      name: 'PostgreSQL 버전',
      sql: 'SELECT version();',
      description: 'PostgreSQL 서버 버전 확인',
    },
    {
      name: 'DB 크기',
      sql: "SELECT pg_size_pretty(pg_database_size(current_database()));",
      description: '현재 데이터베이스의 크기 확인',
    },
    {
      name: '업타임',
      sql: "SELECT date_trunc('second', current_timestamp - pg_postmaster_start_time()) as uptime;",
      description: '서버 가동 시간 확인',
    },
    {
      name: '설정 요약 (Settings)',
      sql: "SELECT name, setting, unit, short_desc FROM pg_settings WHERE name IN ('max_connections', 'shared_buffers', 'work_mem', 'maintenance_work_mem', 'effective_cache_size');",
      description: '주요 메모리 및 연결 설정 확인',
    },
  ],
  Activity: [
    {
      name: '활성 연결 (Active)',
      sql: "SELECT pid, usename, application_name, client_addr, state, date_trunc('second', backend_start) as started FROM pg_stat_activity WHERE state = 'active';",
      description: '현재 실행 중인 모든 세션',
    },
    {
      name: '대기 중인 쿼리 (Waiting)',
      sql: "SELECT pid, usename, wait_event_type, wait_event, query FROM pg_stat_activity WHERE wait_event IS NOT NULL;",
      description: '어떤 이벤트로 대기 중인지 확인',
    },
    {
      name: '오래된 쿼리 (>1분)',
      sql: "SELECT pid, now() - query_start as duration, query FROM pg_stat_activity WHERE state = 'active' AND (now() - query_start) > interval '1 minute';",
      description: '1분 이상 실행 중인 쿼리 발견',
    },
    {
      name: '현재 락(Lock) 정보',
      sql: `SELECT 
    t.relname,
    l.locktype,
    l.page,
    l.virtualtransaction,
    l.pid,
    l.mode,
    l.granted
FROM pg_locks l
JOIN pg_class t ON l.relation = t.oid
WHERE t.relkind = 'r'
ORDER BY l.pid;`,
      description: '테이블별 획득/대기 중인 락 정보',
    },
    {
      name: '연결 상태별 카운트',
      sql: "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;",
      description: '각 상태(active, idle 등)별 연결 수',
    },
  ],
  Performance: [
    {
      name: '캐시 히트율 (Cache Hit Ratio)',
      sql: `SELECT
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit)  as heap_hit,
    round(sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100, 2) as ratio_percent
FROM
    pg_statio_user_tables;`,
      description: '전체 테이블 버퍼 캐시 적중률 (%)',
    },
    {
      name: '인덱스 사용률 (Index Usage)',
      sql: `SELECT 
    relname, 
    100 * idx_scan / (seq_scan + idx_scan) percent_of_times_index_used, 
    n_live_tup rows_in_table
FROM 
    pg_stat_user_tables
WHERE 
    seq_scan + idx_scan > 0 
ORDER BY 
    n_live_tup DESC;`,
      description: '테이블별 시퀀셜 스캔 대비 인덱스 사용 비율',
    },
  ],
  Maintenance: [
    {
      name: '죽은 튜플 비율 (Dead Tuples)',
      sql: `SELECT 
    relname, 
    n_dead_tup, 
    n_live_tup, 
    round(n_dead_tup * 100 / (n_live_tup + n_dead_tup + 1), 2) as dead_ratio
FROM 
    pg_stat_user_tables
WHERE 
    n_dead_tup > 0
ORDER BY 
    n_dead_tup DESC;`,
      description: 'VACUUM이 필요한 테이블 식별 (Dead Tuple 비율)',
    },
    {
      name: '마지막 VACUUM 시간',
      sql: "SELECT relname, last_vacuum, last_autovacuum FROM pg_stat_user_tables ORDER BY last_autovacuum DESC NULLS LAST;",
      description: '테이블별 마지막 VACUUM 실행 시간',
    },
  ],
  Storage: [
    {
      name: '테이블 크기 TOP 10',
      sql: `SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS data_size,
    pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS external_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;`,
      description: '디스크를 가장 많이 차지하는 테이블',
    },
    {
      name: '인덱스 크기 TOP 10',
      sql: `SELECT
    relname AS index_name,
    pg_size_pretty(pg_relation_size(relid)) AS index_size
FROM pg_catalog.pg_statio_user_indexes
ORDER BY pg_relation_size(relid) DESC
LIMIT 10;`,
      description: '디스크를 가장 많이 차지하는 인덱스',
    },
  ],
  Extensions: [
    {
      name: '설치된 확장팩',
      sql: 'SELECT * FROM pg_extension;',
      description: '현재 DB에 설치된 확장팩 목록',
    },
    {
      name: '사용 가능한 확장팩',
      sql: 'SELECT * FROM pg_available_extensions ORDER BY name;',
      description: '설치 가능한 모든 확장팩 목록',
    },
  ],
};

export default function QueryConsolePage() {
  const queryClient = useQueryClient();
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [query, setQuery] = useState<string>('SELECT * FROM pg_stat_activity LIMIT 10;');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState<'results' | 'history' | 'saved'>('results');
  const [showExplain, setShowExplain] = useState(false);
  const [explainResult, setExplainResult] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved instance from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('queryConsole_selectedInstance');
    if (saved) setSelectedInstance(saved);
  }, []);

  // Save instance to localStorage when it changes
  useEffect(() => {
    if (selectedInstance) {
      localStorage.setItem('queryConsole_selectedInstance', selectedInstance);
    }
  }, [selectedInstance]);

  const { data: instances = [] } = useQuery({
    queryKey: ['instances'],
    queryFn: () => inventoryApi.getInstances().then((r) => r.data.instances || []),
  });

  const { data: savedQueries = [] } = useQuery({
    queryKey: ['saved-queries', selectedInstance],
    queryFn: () => queryConsoleApi.getSavedQueries(selectedInstance || undefined).then((r) => r.data),
    enabled: activeTab === 'saved',
  });

  const { data: historyData } = useQuery({
    queryKey: ['query-history', selectedInstance],
    queryFn: () =>
      queryConsoleApi.getHistory({ instanceId: selectedInstance, limit: '50' }).then((r) => r.data),
    enabled: activeTab === 'history' && !!selectedInstance,
  });

  const executeMutation = useMutation({
    mutationFn: (data: { instanceId: string; query: string }) =>
      queryConsoleApi.execute(data).then((r) => r.data),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['query-history'] });
    },
    onError: (error: any) => {
      setResult({
        success: false,
        error: error.response?.data?.message || error.message,
      });
    },
  });

  const explainMutation = useMutation({
    mutationFn: (data: { instanceId: string; query: string; analyze?: boolean }) =>
      queryConsoleApi.explain(data).then((r) => r.data),
    onSuccess: (data) => {
      setExplainResult(data.plan);
      setShowExplain(true);
    },
  });

  const saveQueryMutation = useMutation({
    mutationFn: (data: { name: string; query: string; instanceId?: string }) =>
      queryConsoleApi.saveQuery(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-queries'] });
      alert('쿼리가 저장되었습니다');
    },
  });

  const deleteSavedQueryMutation = useMutation({
    mutationFn: (id: string) => queryConsoleApi.deleteSavedQuery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-queries'] });
      alert('쿼리가 삭제되었습니다');
    },
    onError: (error: any) => {
      alert(`삭제 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const formatMutation = useMutation({
    mutationFn: (query: string) => queryConsoleApi.format(query).then((r) => r.data),
    onSuccess: (data) => {
      setQuery(data.formatted);
    },
  });

  const handleExecute = useCallback((queryOverride?: string) => {
    const queryToExecute = queryOverride || query;
    if (!selectedInstance || !queryToExecute.trim()) return;
    setIsExecuting(true);
    setResult(null);
    executeMutation.mutate(
      { instanceId: selectedInstance, query: queryToExecute.trim() },
      { onSettled: () => setIsExecuting(false) },
    );
  }, [selectedInstance, query, executeMutation]);

  const handleExplain = useCallback(
    (analyze = false) => {
      if (!selectedInstance || !query.trim()) return;
      explainMutation.mutate({ instanceId: selectedInstance, query: query.trim(), analyze });
    },
    [selectedInstance, query, explainMutation],
  );

  const handleFormat = useCallback(() => {
    if (!query.trim()) return;
    formatMutation.mutate(query);
  }, [query, formatMutation]);

  const handleSaveQuery = useCallback(() => {
    const name = prompt('저장할 쿼리 이름을 입력하세요:');
    if (name) {
      saveQueryMutation.mutate({
        name,
        query,
        instanceId: selectedInstance || undefined,
      });
    }
  }, [query, selectedInstance, saveQueryMutation]);

  const handleLoadQuery = useCallback((savedQuery: any) => {
    setQuery(savedQuery.query);
    if (savedQuery.instanceId) {
      setSelectedInstance(savedQuery.instanceId);
    }
    setActiveTab('results');
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleExecute();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        handleFormat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExecute, handleFormat]);

  return (
    <div className="p-6 h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">쿼리 콘솔</h1>
          <p className="text-gray-400 text-sm">SQL 쿼리 실행 및 분석</p>
        </div>
        <select
          value={selectedInstance}
          onChange={(e) => setSelectedInstance(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white min-w-64"
        >
          <option value="">인스턴스 선택</option>
          {instances.map((instance: any) => (
            <option key={instance.id} value={instance.id}>
              {instance.name} ({instance.host}:{instance.port})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 gap-6 min-h-0 overflow-hidden">
        {/* Quick Queries Sidebar */}
        <div className="w-64 flex-shrink-0 flex flex-col glass-card rounded-xl overflow-hidden">
          <div className="p-3 border-b border-gray-800 bg-gray-900/50">
            <h3 className="font-semibold text-gray-300 text-sm flex items-center gap-2">
              <span className="text-blue-400">⚡</span> 빠른 쿼리
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
            {Object.entries(QUICK_QUERIES).map(([category, queries]) => (
              <div key={category}>
                <h4 className="px-2 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {category}
                </h4>
                <div className="space-y-1">
                  {queries.map((q) => (
                    <div
                      key={q.name}
                      className="group flex items-center justify-between p-2 rounded hover:bg-gray-800/50 transition-colors cursor-pointer"
                      onClick={() => setQuery(q.sql)}
                      title={q.description}
                    >
                      <span className="text-sm text-gray-300 group-hover:text-white truncate">
                        {q.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuery(q.sql);
                          // Delay execution slightly to ensure state update if needed, but 
                          // handleExecute now takes an override so we pass it directly.
                          handleExecute(q.sql);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-600/20 text-blue-400 rounded transition-all"
                        title="직접 실행"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Query Editor */}
          <div className="glass-card p-4 mb-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">SQL 쿼리</span>
              <div className="flex gap-2">
                <button
                  onClick={handleFormat}
                  className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                  title="Ctrl+Shift+F"
                >
                  포맷
                </button>
                <button
                  onClick={handleSaveQuery}
                  className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                >
                  저장
                </button>
                <button
                  onClick={() => handleExplain(false)}
                  disabled={!selectedInstance || !query.trim()}
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                >
                  Explain
                </button>
                <button
                  onClick={() => handleExplain(true)}
                  disabled={!selectedInstance || !query.trim()}
                  className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
                >
                  Explain Analyze
                </button>
                <button
                  onClick={() => handleExecute()}
                  disabled={!selectedInstance || !query.trim() || isExecuting}
                  className="px-4 py-1 text-sm bg-postgres-600 hover:bg-postgres-700 text-white rounded disabled:opacity-50"
                  title="Ctrl+Enter"
                >
                  {isExecuting ? '실행 중...' : '실행 (Ctrl+Enter)'}
                </button>
              </div>
            </div>
            <SqlEditor
              value={query}
              onChange={setQuery}
              placeholder="SELECT * FROM your_table;"
              className="h-48"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-800 mb-4 flex-shrink-0">
            <button
              onClick={() => setActiveTab('results')}
              className={`px-4 py-2 rounded-t-lg transition-colors ${
                activeTab === 'results'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              결과
              {result && (
                <span className="ml-2 text-xs text-gray-500">
                  {result.success ? `${result.rowCount} rows` : 'Error'}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-t-lg transition-colors ${
                activeTab === 'history'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              히스토리
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-2 rounded-t-lg transition-colors ${
                activeTab === 'saved'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              저장된 쿼리
            </button>
          </div>

          {/* Results Panel */}
          <div className="flex-1 overflow-hidden w-full max-w-full min-w-0">
            {activeTab === 'results' && (
              <div className="h-full flex flex-col w-full min-w-0 overflow-hidden">
                {result ? (
                  result.success ? (
                    <div className="glass-card flex-1 flex flex-col min-w-0 overflow-hidden rounded-xl relative">
                      <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700 flex justify-between items-center shrink-0">
                        <span className="text-sm text-gray-400">
                          {result.rowCount} 행 · {result.executionTime}ms
                          {result.truncated && (
                            <span className="text-yellow-400 ml-2">(결과 잘림)</span>
                          )}
                        </span>
                        <button
                          onClick={() => {
                            const csv = [
                              result.columns?.join(','),
                              ...result.rows!.map((row) =>
                                result.columns!.map((col) => JSON.stringify(row[col] ?? '')).join(','),
                              ),
                            ].join('\n');
                            const blob = new Blob([csv], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'query_result.csv';
                            a.click();
                          }}
                          className="text-sm text-gray-400 hover:text-white"
                        >
                          CSV 다운로드
                        </button>
                      </div>
                      <div className="flex-1 relative min-h-0 w-full">
                        <div className="absolute inset-0 overflow-auto custom-scrollbar">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-800/30 sticky top-0">
                            <tr>
                              {result.columns?.map((col) => (
                                <th
                                  key={col}
                                  className="text-left px-3 py-2 font-medium text-gray-300 border-b border-gray-700"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {result.rows?.map((row, idx) => (
                              <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/30">
                                {result.columns?.map((col) => (
                                  <td key={col} className="px-3 py-2 text-gray-300 font-mono">
                                    {row[col] === null ? (
                                      <span className="text-gray-500 italic">NULL</span>
                                    ) : typeof row[col] === 'object' ? (
                                      JSON.stringify(row[col])
                                    ) : (
                                      String(row[col])
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="glass-card p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-red-400 text-xl">⚠</span>
                        <div>
                          <h3 className="text-red-400 font-medium">쿼리 실행 오류</h3>
                          <pre className="text-sm text-gray-400 mt-2 whitespace-pre-wrap">
                            {result.error}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="glass-card p-12 text-center text-gray-400">
                    <p>쿼리를 실행하면 결과가 여기에 표시됩니다</p>
                    <p className="text-sm mt-2">Ctrl+Enter로 실행</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="glass-card overflow-hidden h-full">
                <div className="overflow-auto h-full">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800/50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-400">시간</th>
                        <th className="text-left px-4 py-3 text-gray-400">쿼리</th>
                        <th className="text-left px-4 py-3 text-gray-400">실행시간</th>
                        <th className="text-left px-4 py-3 text-gray-400">상태</th>
                        <th className="text-left px-4 py-3 text-gray-400">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData?.history?.map((item: any) => (
                        <tr key={item.id} className="border-t border-gray-800">
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {new Date(item.timestamp).toLocaleString('ko-KR')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="max-w-md" title={item.query}>
                              <SqlDisplay code={item.query} maxHeight="3rem" className="text-xs" />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {item.durationMs || item.executionTime}ms
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 text-xs rounded ${
                                item.success !== false
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {item.success !== false ? '성공' : '실패'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setQuery(item.query)}
                              className="text-postgres-400 hover:text-postgres-300 text-sm"
                            >
                              불러오기
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'saved' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 overflow-auto h-full p-1">
                {savedQueries.map((sq: any) => (
                  <div key={sq.id} className="glass-card p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-white font-medium">{sq.name}</h3>
                        {sq.description && (
                          <p className="text-sm text-gray-400">{sq.description}</p>
                        )}
                      </div>
                      {sq.isPublic && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                          공개
                        </span>
                      )}
                    </div>
                    <SqlDisplay code={sq.query} maxHeight="5rem" className="text-xs mb-2" />
                    <div className="flex justify-between items-center mt-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleLoadQuery(sq)}
                          className="px-3 py-1 text-sm bg-postgres-600 hover:bg-postgres-700 text-white rounded"
                        >
                          불러오기
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('저장된 쿼리를 삭제하시겠습니까?')) {
                              deleteSavedQueryMutation.mutate(sq.id);
                            }
                          }}
                          className="px-3 py-1 text-sm bg-red-900/50 hover:bg-red-900/80 text-red-200 rounded"
                        >
                          삭제
                        </button>
                      </div>
                      <span className="text-xs text-gray-500">
                        {sq.createdBy?.username} · {new Date(sq.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  </div>
                ))}
                {savedQueries.length === 0 && (
                  <div className="col-span-full text-center py-12 text-gray-400">
                    저장된 쿼리가 없습니다
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Explain Modal */}
      {showExplain && explainResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">실행 계획</h2>
              <button
                onClick={() => setShowExplain(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <pre className="flex-1 overflow-auto text-sm text-gray-300 bg-gray-800 p-4 rounded-lg font-mono whitespace-pre-wrap">
              {explainResult}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
