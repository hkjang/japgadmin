import { useState } from 'react';

interface AddColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    dataType: string;
    length?: string;
    isNullable: boolean;
    defaultValue?: string;
  }) => void;
}

export function AddColumnModal({ isOpen, onClose, onSubmit }: AddColumnModalProps) {
  const [name, setName] = useState('');
  const [dataType, setDataType] = useState('text');
  const [length, setLength] = useState('');
  const [isNullable, setIsNullable] = useState(true);
  const [defaultValue, setDefaultValue] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!name) return;
    onSubmit({
      name,
      dataType,
      length: length || undefined,
      isNullable,
      defaultValue: defaultValue || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">컬럼 추가</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">컬럼 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">데이터 타입</label>
              <select
                value={dataType}
                onChange={(e) => setDataType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
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
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">길이</label>
              <input
                type="text"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                placeholder="255"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">기본값</label>
            <input
              type="text"
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isNullable"
              checked={isNullable}
              onChange={(e) => setIsNullable(e.target.checked)}
              className="rounded bg-gray-800 border-gray-700"
            />
            <label htmlFor="isNullable" className="text-sm text-gray-300">Nullable (NULL 허용)</label>
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
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
