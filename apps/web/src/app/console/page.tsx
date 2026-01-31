'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryConsoleApi, inventoryApi } from '@/lib/api';

interface QueryResult {
  success: boolean;
  columns?: string[];
  rows?: any[];
  rowCount?: number;
  executionTime?: number;
  error?: string;
  truncated?: boolean;
}

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

  const formatMutation = useMutation({
    mutationFn: (query: string) => queryConsoleApi.format(query).then((r) => r.data),
    onSuccess: (data) => {
      setQuery(data.formatted);
    },
  });

  const handleExecute = useCallback(() => {
    if (!selectedInstance || !query.trim()) return;
    setIsExecuting(true);
    setResult(null);
    executeMutation.mutate(
      { instanceId: selectedInstance, query: query.trim() },
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
    <div className="p-6 h-screen flex flex-col">
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

      {/* Query Editor */}
      <div className="glass-card p-4 mb-4">
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
              onClick={handleExecute}
              disabled={!selectedInstance || !query.trim() || isExecuting}
              className="px-4 py-1 text-sm bg-postgres-600 hover:bg-postgres-700 text-white rounded disabled:opacity-50"
              title="Ctrl+Enter"
            >
              {isExecuting ? '실행 중...' : '실행 (Ctrl+Enter)'}
            </button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SELECT * FROM your_table;"
          className="w-full h-40 p-3 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-postgres-500"
          spellCheck={false}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 mb-4">
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
      <div className="flex-1 overflow-hidden">
        {activeTab === 'results' && (
          <div className="h-full flex flex-col">
            {result ? (
              result.success ? (
                <div className="glass-card flex-1 overflow-hidden flex flex-col">
                  <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700 flex justify-between items-center">
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
                  <div className="flex-1 overflow-auto">
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
                        <p className="text-gray-300 text-xs font-mono truncate max-w-md" title={item.query}>
                          {item.query}
                        </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-auto h-full p-1">
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
                <pre className="text-xs text-gray-500 bg-gray-900 p-2 rounded overflow-hidden max-h-20">
                  {sq.query}
                </pre>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs text-gray-500">
                    {sq.createdBy?.username} · {new Date(sq.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                  <button
                    onClick={() => handleLoadQuery(sq)}
                    className="px-3 py-1 text-sm bg-postgres-600 hover:bg-postgres-700 text-white rounded"
                  >
                    불러오기
                  </button>
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
