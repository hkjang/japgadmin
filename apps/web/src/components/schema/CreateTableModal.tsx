import { useState } from 'react';

interface ColumnDef {
  name: string;
  dataType: string;
  length?: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string;
}

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { schema: string; name: string; columns: ColumnDef[] }) => void;
  schemas: string[];
}

export function CreateTableModal({ isOpen, onClose, onSubmit, schemas }: CreateTableModalProps) {
  const [schema, setSchema] = useState(schemas[0] || 'public');
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDef[]>([
    { name: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true },
  ]);

  if (!isOpen) return null;

  const handleAddColumn = () => {
    setColumns([
      ...columns,
      { name: '', dataType: 'text', isNullable: true, isPrimaryKey: false },
    ]);
  };

  const handleRemoveColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, field: keyof ColumnDef, value: any) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    setColumns(newColumns);
  };

  const handleSubmit = () => {
    if (!tableName) return;
    onSubmit({ schema, name: tableName, columns });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <h2 className="text-xl font-bold text-white mb-4">새 테이블 생성</h2>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">스키마</label>
              <select
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
              >
                {schemas.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">테이블 이름</label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                placeholder="table_name"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-400">컬럼 정의</label>
              <button
                onClick={handleAddColumn}
                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                + 컬럼 추가
              </button>
            </div>
            <div className="space-y-2">
              {columns.map((col, idx) => (
                <div key={idx} className="flex gap-2 items-start bg-gray-800/50 p-3 rounded">
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                    placeholder="컬럼명"
                    className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  />
                  <select
                    value={col.dataType}
                    onChange={(e) => updateColumn(idx, 'dataType', e.target.value)}
                    className="w-32 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  >
                    <option value="integer">integer</option>
                    <option value="bigint">bigint</option>
                    <option value="text">text</option>
                    <option value="varchar">varchar</option>
                    <option value="boolean">boolean</option>
                    <option value="timestamp">timestamp</option>
                    <option value="date">date</option>
                    <option value="jsonb">jsonb</option>
                    <option value="uuid">uuid</option>
                  </select>
                  <input
                    type="text"
                    value={col.length || ''}
                    onChange={(e) => updateColumn(idx, 'length', e.target.value)}
                    placeholder="길이"
                    className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  />
                  <input
                    type="text"
                    value={col.defaultValue || ''}
                    onChange={(e) => updateColumn(idx, 'defaultValue', e.target.value)}
                    placeholder="기본값"
                    className="w-24 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  />
                  <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-1 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={col.isPrimaryKey}
                        onChange={(e) => updateColumn(idx, 'isPrimaryKey', e.target.checked)}
                      /> PK
                    </label>
                    <label className="flex items-center gap-1 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={col.isNullable}
                        onChange={(e) => updateColumn(idx, 'isNullable', e.target.checked)}
                      /> NULL
                    </label>
                  </div>
                  <button
                    onClick={() => handleRemoveColumn(idx)}
                    className="text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg"
          >
            테이블 생성
          </button>
        </div>
      </div>
    </div>
  );
}
