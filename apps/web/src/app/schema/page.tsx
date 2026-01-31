'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { schemaApi, inventoryApi } from '@/lib/api';

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">스키마 브라우저</h1>
          <p className="text-gray-400 mt-1">데이터베이스 구조 탐색</p>
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
  const [showDDL, setShowDDL] = useState(false);

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
    <div className="grid grid-cols-12 gap-6">
      {/* Left Panel - Navigation */}
      <div className="col-span-3 space-y-4">
        {/* Search */}
        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="테이블, 컬럼 검색..."
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
          />
          {searchResults.length > 0 && searchQuery.length >= 2 && (
            <div className="mt-2 glass-card p-2 max-h-48 overflow-y-auto">
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
        <div className="glass-card p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">스키마</h3>
          {schemasError ? (
             <div className="p-2 bg-red-900/50 text-red-200 rounded text-xs mb-2">
               로드 실패: {(schemasErrorObj as any)?.response?.status === 403 ? '권한 없음' : (schemasErrorObj as any)?.message || '오류 발생'}
             </div>
          ) : null}
          {schemasLoading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 bg-gray-800 rounded"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
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
          )}
        </div>

        {/* Tables */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            테이블 ({filteredTables.length})
          </h3>
          {tablesLoading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-6 bg-gray-800 rounded"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
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
                  <span className="text-gray-500">{table.schema}.</span>
                  {table.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Details */}
      <div className="col-span-9 space-y-4">
        {selectedTable ? (
          <>
            {/* Table Header */}
            <div className="glass-card p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {selectedSchema}.{selectedTable}
                </h2>
                <p className="text-sm text-gray-400">
                  {columns.length} 컬럼 · {indexes.length} 인덱스
                </p>
              </div>
              <button
                onClick={() => setShowDDL(!showDDL)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                {showDDL ? 'DDL 숨기기' : 'DDL 보기'}
              </button>
            </div>

            {/* DDL */}
            {showDDL && ddlData?.ddl && (
              <div className="glass-card p-4">
                <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">
                  {ddlData.ddl}
                </pre>
              </div>
            )}

            {/* Columns */}
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700">
                <h3 className="font-medium text-white">컬럼</h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-800/30">
                  <tr>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">이름</th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">타입</th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">Nullable</th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">기본값</th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">설명</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col: any) => (
                    <tr key={col.name} className="border-t border-gray-800">
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
                      <td className="px-4 py-2 text-gray-500 text-sm">{col.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Indexes */}
            {indexes.length > 0 && (
              <div className="glass-card overflow-hidden">
                <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700">
                  <h3 className="font-medium text-white">인덱스</h3>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-800/30">
                    <tr>
                      <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">이름</th>
                      <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">타입</th>
                      <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">유니크</th>
                      <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">컬럼</th>
                      <th className="text-left px-4 py-2 text-sm font-medium text-gray-400">크기</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indexes.map((idx: any) => (
                      <tr key={idx.name} className="border-t border-gray-800">
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
                        <td className="px-4 py-2 text-gray-400 text-sm">{idx.sizePretty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="glass-card p-12 text-center">
            <p className="text-gray-400">테이블을 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
