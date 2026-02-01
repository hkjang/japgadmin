'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schemaApi, inventoryApi } from '@/lib/api';
import { CreateTableModal } from '@/components/schema/CreateTableModal';
import { AddColumnModal } from '@/components/schema/AddColumnModal';
import { CreateIndexModal } from '@/components/schema/CreateIndexModal';

export default function SchemaPage() {
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: instances = [] } = useQuery({
    queryKey: ['instances'],
    queryFn: () => inventoryApi.getInstances().then((r) => r.data.instances || []),
  });

  return (
    <div className="p-6 space-y-6 h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">스키마 관리</h1>
          <p className="text-gray-400 mt-1">데이터베이스 구조 탐색 및 관리</p>
        </div>
        <select
          value={selectedInstance}
          onChange={(e) => {
            setSelectedInstance(e.target.value);
            setSelectedSchema('');
            setSelectedTable('');
          }}
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
        <SchemaBrowserContent
          instanceId={selectedInstance}
          selectedSchema={selectedSchema}
          setSelectedSchema={setSelectedSchema}
          selectedTable={selectedTable}
          setSelectedTable={setSelectedTable}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      ) : (
        <div className="glass-card p-12 text-center">
          <p className="text-gray-400">스키마를 탐색할 인스턴스를 선택하세요</p>
        </div>
      )}
    </div>
  );
}

function SchemaBrowserContent({
  instanceId,
  selectedSchema,
  setSelectedSchema,
  selectedTable,
  setSelectedTable,
  searchQuery,
  setSearchQuery,
}: {
  instanceId: string;
  selectedSchema: string;
  setSelectedSchema: (s: string) => void;
  selectedTable: string;
  setSelectedTable: (t: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}) {
  const queryClient = useQueryClient();
  const [showDDL, setShowDDL] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [isCreateIndexModalOpen, setIsCreateIndexModalOpen] = useState(false);

  const { data: schemas = [], isLoading: schemasLoading, isError: schemasError, error: schemasErrorObj } = useQuery({
    queryKey: ['schemas', instanceId],
    queryFn: () => schemaApi.getSchemas(instanceId).then((r) => r.data),
  });

  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ['tables', instanceId, selectedSchema],
    queryFn: () => schemaApi.getTables(instanceId, selectedSchema || undefined).then((r) => r.data),
    enabled: true,
  });

  const { data: columns = [] } = useQuery({
    queryKey: ['columns', instanceId, selectedSchema, selectedTable],
    queryFn: () =>
      schemaApi.getTableColumns(instanceId, selectedSchema, selectedTable).then((r) => r.data),
    enabled: !!selectedSchema && !!selectedTable,
  });

  const { data: indexes = [] } = useQuery({
    queryKey: ['indexes', instanceId, selectedSchema, selectedTable],
    queryFn: () =>
      schemaApi.getIndexes(instanceId, selectedSchema, selectedTable).then((r) => r.data),
    enabled: !!selectedSchema && !!selectedTable,
  });

  const { data: ddlData } = useQuery({
    queryKey: ['ddl', instanceId, selectedSchema, selectedTable],
    queryFn: () => schemaApi.getDDL(instanceId, selectedSchema, selectedTable).then((r) => r.data),
    enabled: !!selectedSchema && !!selectedTable && showDDL,
  });

  const { data: searchResultsRaw } = useQuery({
    queryKey: ['schema-search', instanceId, searchQuery],
    queryFn: () => schemaApi.searchObjects(instanceId, searchQuery).then((r) => r.data),
    enabled: searchQuery.length >= 2,
  });

  // Mutations
  const createTableMutation = useMutation({
    mutationFn: (data: any) => schemaApi.createTable(instanceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', instanceId] });
      alert('테이블이 생성되었습니다.');
    },
    onError: (err: any) => alert(`테이블 생성 실패: ${err.message}`),
  });

  const dropTableMutation = useMutation({
    mutationFn: (data: { schema: string; table: string }) =>
      schemaApi.dropTable(instanceId, data.schema, data.table),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', instanceId] });
      setSelectedTable('');
      alert('테이블이 삭제되었습니다.');
    },
    onError: (err: any) => alert(`테이블 삭제 실패: ${err.message}`),
  });

  const addColumnMutation = useMutation({
    mutationFn: (column: any) =>
      schemaApi.addColumn(instanceId, selectedSchema, selectedTable, column),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['columns', instanceId, selectedSchema, selectedTable] });
      alert('컬럼이 추가되었습니다.');
    },
    onError: (err: any) => alert(`컬럼 추가 실패: ${err.message}`),
  });

  const dropColumnMutation = useMutation({
    mutationFn: (columnName: string) =>
      schemaApi.dropColumn(instanceId, selectedSchema, selectedTable, columnName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['columns', instanceId, selectedSchema, selectedTable] });
      alert('컬럼이 삭제되었습니다.');
    },
    onError: (err: any) => alert(`컬럼 삭제 실패: ${err.message}`),
  });

  const createIndexMutation = useMutation({
    mutationFn: (data: any) => schemaApi.createIndex(instanceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indexes', instanceId, selectedSchema, selectedTable] });
      alert('인덱스가 생성되었습니다.');
    },
    onError: (err: any) => alert(`인덱스 생성 실패: ${err.message}`),
  });

  const dropIndexMutation = useMutation({
    mutationFn: (indexName: string) =>
      schemaApi.dropIndex(instanceId, selectedSchema, indexName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indexes', instanceId, selectedSchema, selectedTable] });
      alert('인덱스가 삭제되었습니다.');
    },
    onError: (err: any) => alert(`인덱스 삭제 실패: ${err.message}`),
  });

  // Flatten search results
  const searchResults = [];
  if (searchResultsRaw) {
    if (Array.isArray(searchResultsRaw.tables)) {
      searchResults.push(...searchResultsRaw.tables.map((t: any) => ({ ...t, kind: 'table' })));
    }
    if (Array.isArray(searchResultsRaw.columns)) {
      searchResults.push(...searchResultsRaw.columns.map((c: any) => ({ ...c, kind: 'column', type: 'column' })));
    }
    if (Array.isArray(searchResultsRaw.functions)) {
      searchResults.push(...searchResultsRaw.functions.map((f: any) => ({ ...f, kind: 'function', type: 'function' })));
    }
  }

  const filteredTables = selectedSchema
    ? tables.filter((t: any) => t.schema === selectedSchema)
    : tables;

  return (
    <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 overflow-hidden">
      {/* Left Panel - Navigation */}
      <div className="col-span-3 space-y-4 flex flex-col h-full overflow-hidden">
        {/* Search */}
        <div className="shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="테이블, 컬럼 검색..."
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
          />
          {searchResults.length > 0 && searchQuery.length >= 2 && (
            <div className="mt-2 glass-card p-2 max-h-48 overflow-y-auto z-10 relative">
              {searchResults.map((result: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedSchema(result.schema);
                    if (result.kind === 'table') {
                        setSelectedTable(result.name);
                    } else if (result.kind === 'column') {
                        setSelectedTable(result.table);
                    }
                    setSearchQuery('');
                  }}
                  className="w-full text-left px-2 py-1 hover:bg-gray-800 rounded text-sm"
                >
                  <span className="text-gray-400">{result.type}</span>
                  <span className="text-white ml-2">
                    {result.schema}.{result.kind === 'column' ? `${result.table}.${result.name}` : result.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Schemas */}
        <div className="glass-card p-4 shrink-0 max-h-[30vh] overflow-hidden flex flex-col">
          <h3 className="text-sm font-medium text-gray-400 mb-2 shrink-0">스키마</h3>
          {schemasError ? (
             <div className="p-2 bg-red-900/50 text-red-200 rounded text-xs mb-2">
               로드 실패
             </div>
          ) : null}
          <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1">
            <button
              onClick={() => setSelectedSchema('')}
              className={`w-full text-left px-2 py-1 rounded text-sm ${
                !selectedSchema ? 'bg-postgres-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              전체
            </button>
            {schemas.map((schema: any) => (
              <button
                key={schema.name}
                onClick={() => setSelectedSchema(schema.name)}
                className={`w-full text-left px-2 py-1 rounded text-sm ${
                  selectedSchema === schema.name
                    ? 'bg-postgres-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {schema.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tables */}
        <div className="glass-card p-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h3 className="text-sm font-medium text-gray-400">
              테이블 ({filteredTables.length})
            </h3>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="text-xs bg-postgres-600 hover:bg-postgres-700 text-white px-2 py-1 rounded"
            >
              + 생성
            </button>
          </div>
          
          <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1">
            {filteredTables.map((table: any) => (
              <button
                key={`${table.schema}.${table.name}`}
                onClick={() => {
                  setSelectedSchema(table.schema);
                  setSelectedTable(table.name);
                }}
                className={`w-full text-left px-2 py-1 rounded text-sm ${
                  selectedTable === table.name && selectedSchema === table.schema
                    ? 'bg-postgres-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <div className="flex justify-between items-center group">
                  <span>
                    <span className="text-gray-500">{table.schema}.</span>
                    {table.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Details */}
      <div className="col-span-9 space-y-4 flex flex-col h-full overflow-hidden">
        {selectedTable ? (
          <div className="flex flex-col h-full space-y-4 overflow-y-auto custom-scrollbar pr-2">
            {/* Table Header */}
            <div className="glass-card p-4 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {selectedSchema}.{selectedTable}
                </h2>
                <p className="text-sm text-gray-400">
                  {columns.length} 컬럼 · {indexes.length} 인덱스
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDDL(!showDDL)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                >
                  {showDDL ? 'DDL 숨기기' : 'DDL 보기'}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`정말로 테이블 ${selectedSchema}.${selectedTable}을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
                      dropTableMutation.mutate({ schema: selectedSchema, table: selectedTable });
                    }
                  }}
                  className="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 text-red-200 rounded-lg"
                >
                  테이블 삭제
                </button>
              </div>
            </div>

            {/* DDL */}
            {showDDL && ddlData?.ddl && (
              <div className="glass-card p-4 shrink-0">
                <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">
                  {ddlData.ddl}
                </pre>
              </div>
            )}

            {/* Columns */}
            <div className="glass-card overflow-hidden shrink-0">
              <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700 flex justify-between items-center">
                <h3 className="font-medium text-white">컬럼</h3>
                <button
                  onClick={() => setIsAddColumnModalOpen(true)}
                  className="text-xs bg-postgres-600 hover:bg-postgres-700 text-white px-2 py-1 rounded"
                >
                  + 컬럼 추가
                </button>
              </div>
              <table className="w-full">
                <thead className="bg-gray-800/30">
                  <tr>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">이름</th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">타입</th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">Nullable</th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">기본값</th>
                    <th className="text-right px-4 py-2 text-sm font-medium text-gray-400">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col: any) => (
                    <tr key={col.name} className="border-t border-gray-800 group">
                      <td className="px-4 py-2">
                        <span className="text-white font-mono">{col.name}</span>
                        {col.isPrimaryKey && (
                          <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-1 rounded">
                            PK
                          </span>
                        )}
                        {col.isForeignKey && (
                          <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-1 rounded">
                            FK
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-300 font-mono text-sm">
                        {col.dataType}
                        {col.maxLength && `(${col.maxLength})`}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs ${
                            col.isNullable ? 'text-gray-400' : 'text-blue-400'
                          }`}
                        >
                          {col.isNullable ? 'NULL' : 'NOT NULL'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-sm font-mono">
                        {col.columnDefault || '-'}
                      </td>
                      <td className="px-4 py-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            if (confirm(`컬럼 ${col.name}을(를) 삭제하시겠습니까?`)) {
                              dropColumnMutation.mutate(col.name);
                            }
                          }}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Indexes */}
            <div className="glass-card overflow-hidden shrink-0">
              <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700 flex justify-between items-center">
                <h3 className="font-medium text-white">인덱스</h3>
                <button
                  onClick={() => setIsCreateIndexModalOpen(true)}
                  className="text-xs bg-postgres-600 hover:bg-postgres-700 text-white px-2 py-1 rounded"
                >
                  + 인덱스 추가
                </button>
              </div>
              <table className="w-full">
                <thead className="bg-gray-800/30">
                  <tr>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">이름</th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">타입</th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">유니크</th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">컬럼</th>
                    <th className="text-right px-4 py-2 text-sm font-medium text-gray-400">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {indexes.map((idx: any) => (
                    <tr key={idx.name} className="border-t border-gray-800 group">
                      <td className="px-4 py-2 text-white font-mono">{idx.name}</td>
                      <td className="px-4 py-2 text-gray-300">{idx.indexType}</td>
                      <td className="px-4 py-2">
                        {idx.isUnique ? (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-1 rounded">
                            Unique
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-sm">
                        {Array.isArray(idx.columns) ? idx.columns.join(', ') : idx.columns}
                      </td>
                      <td className="px-4 py-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            if (confirm(`인덱스 ${idx.name}을(를) 삭제하시겠습니까?`)) {
                              dropIndexMutation.mutate(idx.name);
                            }
                          }}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                  {indexes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                        인덱스가 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="glass-card p-12 text-center h-full flex items-center justify-center">
            <p className="text-gray-400">테이블을 선택하거나 새 테이블을 생성하세요</p>
          </div>
        )}
      </div>

      <CreateTableModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={(data) => createTableMutation.mutate(data)}
        schemas={schemas.map((s: any) => s.name)}
      />

      <AddColumnModal
        isOpen={isAddColumnModalOpen}
        onClose={() => setIsAddColumnModalOpen(false)}
        onSubmit={(data) => addColumnMutation.mutate(data)}
      />

      <CreateIndexModal
        isOpen={isCreateIndexModalOpen}
        onClose={() => setIsCreateIndexModalOpen(false)}
        onSubmit={(data) =>
          createIndexMutation.mutate({
            schema: selectedSchema,
            tableName: selectedTable,
            ...data,
          })
        }
        columns={columns.map((c: any) => c.name)}
      />
    </div>
  );
}
