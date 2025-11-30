'use client';

import { useState, useEffect } from 'react';
import { alertApi } from '@/lib/api';

export default function AlertConfig() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newConfig, setNewConfig] = useState({
    name: '',
    alertType: 'connection',
    threshold: 80,
    webhookUrl: '',
  });

  const fetchConfigs = async () => {
    try {
      const res = await alertApi.getConfigs();
      setConfigs(res.data.configs);
    } catch (error) {
      console.error('Failed to fetch alert configs', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await alertApi.createConfig({
        ...newConfig,
        enabled: true,
      });
      setNewConfig({ name: '', alertType: 'connection', threshold: 80, webhookUrl: '' });
      fetchConfigs();
    } catch (error) {
      alert('Failed to create alert config');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await alertApi.deleteConfig(id);
      fetchConfigs();
    } catch (error) {
      alert('Failed to delete config');
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await alertApi.updateConfig(id, { enabled });
      fetchConfigs();
    } catch (error) {
      console.error('Failed to toggle config', error);
    }
  };

  if (loading) return <div>Loading settings...</div>;

  return (
    <div className="space-y-8">
      {/* Create New Alert */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Create New Alert Rule</h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Rule Name</label>
            <input
              type="text"
              value={newConfig.name}
              onChange={e => setNewConfig({ ...newConfig, name: e.target.value })}
              className="w-full bg-slate-800 border border-gray-700 rounded px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Alert Type</label>
            <select
              value={newConfig.alertType}
              onChange={e => setNewConfig({ ...newConfig, alertType: e.target.value })}
              className="w-full bg-slate-800 border border-gray-700 rounded px-3 py-2 text-white"
            >
              <option value="connection">Connection Usage (%)</option>
              <option value="query_time">Slow Query Time (ms)</option>
              <option value="disk_space">Disk Space Usage (%)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Threshold</label>
            <input
              type="number"
              value={newConfig.threshold}
              onChange={e => setNewConfig({ ...newConfig, threshold: Number(e.target.value) })}
              className="w-full bg-slate-800 border border-gray-700 rounded px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Slack Webhook URL (Optional)</label>
            <input
              type="text"
              value={newConfig.webhookUrl}
              onChange={e => setNewConfig({ ...newConfig, webhookUrl: e.target.value })}
              className="w-full bg-slate-800 border border-gray-700 rounded px-3 py-2 text-white"
              placeholder="https://hooks.slack.com/..."
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors"
            >
              Create Rule
            </button>
          </div>
        </form>
      </div>

      {/* Existing Rules */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Active Alert Rules</h3>
        </div>
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-slate-800 text-gray-200 uppercase font-medium">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Threshold</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {configs.map((config) => (
              <tr key={config.id} className="hover:bg-slate-800/50">
                <td className="px-6 py-4 font-medium text-white">{config.name}</td>
                <td className="px-6 py-4">{config.alertType}</td>
                <td className="px-6 py-4 font-mono">{config.threshold}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleToggle(config.id, !config.enabled)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      config.enabled 
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                        : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                    }`}
                  >
                    {config.enabled ? 'Active' : 'Disabled'}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {configs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No alert rules configured
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
