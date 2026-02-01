'use client';

import { useState, useEffect } from 'react';
import { settingsApi } from '@/lib/api';
import { toast } from 'sonner';

export default function GeneralSettings() {
  const [settings, setSettings] = useState({
    system_name: '',
    theme: 'dark',
    language: 'ko',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await settingsApi.getSettings();
      setSettings(res.data);
    } catch (error) {
      console.error('Failed to fetch settings', error);
      // Optional: don't show error toast on initial load if it's 404 or empty
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await settingsApi.updateSettings(settings);
      toast.success('설정이 저장되었습니다.');
      // Reload page or update context if needed (e.g. language/theme change)
    } catch (error) {
      toast.error('설정 저장 실패');
    }
  };

  if (loading) return <div>로딩 중...</div>;

  return (
    <div className="glass-card p-6">
      <h3 className="text-xl font-semibold text-white mb-6">일반 설정</h3>
      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">시스템 이름</label>
          <input
            type="text"
            name="system_name"
            value={settings.system_name}
            onChange={handleChange}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">테마</label>
          <select
            name="theme"
            value={settings.theme}
            onChange={handleChange}
            className="input-field"
          >
            <option value="dark">다크 모드</option>
            <option value="light">라이트 모드</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">언어</label>
          <select
            name="language"
            value={settings.language}
            onChange={handleChange}
            className="input-field"
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </div>

        <button type="submit" className="btn-primary">
          변경사항 저장
        </button>
      </form>
    </div>
  );
}
