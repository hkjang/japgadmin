import { useState } from 'react';

interface CreateIndexModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    indexName: string;
    columns: string[];
    isUnique: boolean;
  }) => void;
  columns: string[];
}

export function CreateIndexModal({ isOpen, onClose, onSubmit, columns }: CreateIndexModalProps) {
  const [indexName, setIndexName] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [isUnique, setIsUnique] = useState(false);

  if (!isOpen) return null;

  const toggleColumn = (col: string) => {
    if (selectedColumns.includes(col)) {
      setSelectedColumns(selectedColumns.filter((c) => c !== col));
    } else {
      setSelectedColumns([...selectedColumns, col]);
    }
  };

  const handleSubmit = () => {
    if (!indexName || selectedColumns.length === 0) return;
    onSubmit({
      indexName,
      columns: selectedColumns,
      isUnique,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">인덱스 생성</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">인덱스 이름</label>
            <input
              type="text"
              value={indexName}
              onChange={(e) => setIndexName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">컬럼 선택</label>
            <div className="max-h-48 overflow-y-auto bg-gray-800 rounded p-2 border border-gray-700">
              {columns.map((col) => (
                <div key={col} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col)}
                    onChange={() => toggleColumn(col)}
                    id={`col-${col}`}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  <label htmlFor={`col-${col}`} className="text-sm text-gray-300 cursor-pointer">
                    {col}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isUnique"
              checked={isUnique}
              onChange={(e) => setIsUnique(e.target.checked)}
              className="rounded bg-gray-800 border-gray-700"
            />
            <label htmlFor="isUnique" className="text-sm text-gray-300">Unique Index (유니크)</label>
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
            className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg disabled:opacity-50"
            disabled={!indexName || selectedColumns.length === 0}
          >
            생성
          </button>
        </div>
      </div>
    </div>
  );
}
