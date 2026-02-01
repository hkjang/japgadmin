'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replicationApi } from '@/lib/api';
import { Trash2, Plus, Database, AlertCircle } from 'lucide-react';

interface ReplicationSlot {
  slotName: string;
  slotType: string;
  active: boolean;
  walStatus: string;
  restartLsn: string;
  confirmedFlushLsn: string;
}

interface ReplicationSlotsProps {
  instanceId: string;
  slots: ReplicationSlot[];
}

export default function ReplicationSlots({ instanceId, slots = [] }: ReplicationSlotsProps) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newSlotName, setNewSlotName] = useState('');
  const [isLogical, setIsLogical] = useState(false);

  const createMutation = useMutation({
    mutationFn: () => replicationApi.createSlot(instanceId, newSlotName, isLogical),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replication-status', instanceId] });
      setIsCreating(false);
      setNewSlotName('');
      setIsLogical(false);
      alert('복제 슬롯이 생성되었습니다');
    },
    onError: (error: any) => {
      alert(`슬롯 생성 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (slotName: string) => replicationApi.dropSlot(instanceId, slotName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replication-status', instanceId] });
      alert('복제 슬롯이 삭제되었습니다');
    },
    onError: (error: any) => {
      alert(`슬롯 삭제 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-postgres-400" />
          복제 슬롯 관리
        </h3>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          새 슬롯
        </button>
      </div>

      {isCreating && (
        <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700 animate-in fade-in slide-in-from-top-2">
          <h4 className="text-sm font-medium text-white mb-3">새 복제 슬롯 생성</h4>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">슬롯 이름</label>
              <input
                type="text"
                value={newSlotName}
                onChange={(e) => setNewSlotName(e.target.value)}
                placeholder="slot_name"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:border-postgres-500 focus:ring-1 focus:ring-postgres-500 outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-300 mb-2 mt-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLogical}
                  onChange={(e) => setIsLogical(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-postgres-500 focus:ring-postgres-500"
                />
                Logical Slot
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newSlotName || createMutation.isPending}
                className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 disabled:opacity-50 text-white rounded text-sm"
              >
                {createMutation.isPending ? '생성 중...' : '생성'}
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
              >
                취소
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            * 슬롯 이름은 소문자, 숫자, 밑줄만 사용할 수 있습니다.
          </p>
        </div>
      )}

      {slots.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-gray-800/30 rounded-lg border border-gray-700/50">
          <p>활성 복제 슬롯이 없습니다</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase bg-gray-800/50">
              <tr>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">타입</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">WAL 상태</th>
                <th className="px-4 py-3">LSN 정보</th>
                <th className="px-4 py-3 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {slots.map((slot) => (
                <tr key={slot.slotName} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-medium text-white">{slot.slotName}</td>
                  <td className="px-4 py-3 text-gray-300">{slot.slotType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        slot.active
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-600/50 text-gray-400'
                      }`}
                    >
                      {slot.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        slot.walStatus === 'lost'
                          ? 'bg-red-500/20 text-red-400'
                          : slot.walStatus === 'extended'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {slot.walStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                    <div>Restart: {slot.restartLsn || '-'}</div>
                    <div>Flush: {slot.confirmedFlushLsn || '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`'${slot.slotName}' 슬롯을 삭제하시겠습니까?`)) {
                          deleteMutation.mutate(slot.slotName);
                        }
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="슬롯 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
