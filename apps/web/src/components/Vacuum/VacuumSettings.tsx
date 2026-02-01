'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { vacuumApi, VacuumGlobalSetting } from '@/lib/api';
import { useTranslation } from 'react-i18next'; // Assuming i18n is used
import { toast } from 'sonner';

export default function VacuumSettings() {
  const { t } = useTranslation();
  const [globalSettings, setGlobalSettings] = useState<VacuumGlobalSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableSettings, setTableSettings] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);

  const fetchGlobalSettings = useCallback(async () => {
    try {
      const res = await vacuumApi.getGlobalSettings();
      setGlobalSettings(res.data);
    } catch (error) {
      console.error(error);
      toast.error('글로벌 설정을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalSettings();
  }, [fetchGlobalSettings]);

  const loadTableSettings = async () => {
    if (!selectedTable) return;
    try {
      const res = await vacuumApi.getTableSettings(selectedTable);
      setTableSettings(res.data || {});
      setIsEditing(true);
    } catch (error) {
      console.error(error);
      toast.error('테이블 설정을 불러오는데 실패했습니다');
    }
  };

  const saveTableSettings = async (settings: Record<string, string | null>) => {
    try {
      await vacuumApi.updateTableSettings(selectedTable, settings);
      toast.success('테이블 설정이 업데이트되었습니다');
      setIsEditing(false);
      setTableSettings({});
    } catch (error) {
      console.error(error);
      toast.error('설정 업데이트 실패');
    }
  };

  return (
    <div className="space-y-6">
      {/* Global Settings Viewer */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-bold text-white mb-4">글로벌 Autovacuum 설정 (읽기 전용)</h3>
        {loading ? (
          <p className="text-gray-400">로딩 중...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3">매개변수</th>
                  <th className="px-4 py-3">값</th>
                  <th className="px-4 py-3">단위</th>
                  <th className="px-4 py-3">최소/최대</th>
                  <th className="px-4 py-3">설명</th>
                </tr>
              </thead>
              <tbody>
                {globalSettings.map((setting) => (
                  <tr key={setting.name} className="border-b border-gray-700 hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-white">{setting.name}</td>
                    <td className="px-4 py-3 text-postgres-300">{setting.setting}</td>
                    <td className="px-4 py-3 text-gray-500">{setting.unit}</td>
                    <td className="px-4 py-3 text-gray-500">{setting.min_val} - {setting.max_val}</td>
                    <td className="px-4 py-3 text-gray-400">{setting.short_desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Table Settings Editor (Simple Implementation) */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-bold text-white mb-4">테이블별 설정</h3>
        <div className="flex gap-4 mb-4">
          <input 
            type="text" 
            placeholder="테이블 이름 입력 (예: users)" 
            className="input-field max-w-sm"
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
          />
          <button onClick={loadTableSettings} className="btn-primary">
            설정 불러오기
          </button>
        </div>

        {isEditing && (
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            <h4 className="text-lg font-medium text-white mb-3">수정 중: {selectedTable}</h4>
            <TableSettingsForm initialSettings={tableSettings} onSave={saveTableSettings} onCancel={() => setIsEditing(false)} />
          </div>
        )}
      </div>
    </div>
  );
}

function TableSettingsForm({ initialSettings, onSave, onCancel }: any) {
  // Common autovacuum settings
  const commonKeys = [
    'autovacuum_enabled',
    'autovacuum_vacuum_threshold',
    'autovacuum_vacuum_scale_factor',
    'autovacuum_analyze_threshold',
    'autovacuum_analyze_scale_factor',
    'autovacuum_vacuum_cost_delay',
    'autovacuum_vacuum_cost_limit'
  ];

  const [formData, setFormData] = useState<Record<string, string>>(initialSettings);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Diff with initial? Or just send all overrides. 
    // If value is empty string, treated as reset (null)
    const updatePayload: Record<string, string | null> = {};
    Object.entries(formData).forEach(([key, val]) => {
      if (val === '') updatePayload[key] = null; // Reset
      else updatePayload[key] = val;
    });
    onSave(updatePayload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {commonKeys.map((key) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-400 mb-1">{key}</label>
            <input
              type="text"
              className="input-field text-sm"
              placeholder="기본값"
              value={formData[key] || ''}
              onChange={(e) => setFormData({...formData, [key]: e.target.value})}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-300 hover:text-white">취소</button>
        <button type="submit" className="btn-primary">변경사항 저장</button>
      </div>
    </form>
  );
}
