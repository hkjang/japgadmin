'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { retentionApi, inventoryApi } from '@/lib/api';
import { Loader2, Trash2, Plus, CalendarClock } from 'lucide-react';
// Using standard HTML elements styled with Tailwind as per instructions

export default function RetentionSettings() {
  const { t } = useTranslation();
  const [policies, setPolicies] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    instanceId: '',
    schema: 'public',
    table: '',
    dateColumn: '',
    retentionDays: 30,
    cronExpression: '0 0 * * *',
  });
  const [creating, setCreating] = useState(false);

  // Fetch instances for dropdown
  useEffect(() => {
    inventoryApi.getInstances().then((res) => {
      setInstances(res.data);
      if (res.data.length > 0) {
        setFormData(prev => ({ ...prev, instanceId: res.data[0].id }));
      }
    });
  }, []);

  // Fetch policies when instance changes (or initial)
  useEffect(() => {
    if (formData.instanceId) {
      fetchPolicies(formData.instanceId);
    }
  }, [formData.instanceId]);

  const fetchPolicies = async (instanceId: string) => {
    setLoading(true);
    try {
      const res = await retentionApi.getPolicies(instanceId);
      setPolicies(res.data);
    } catch (error) {
      console.error('Failed to fetch retention policies', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await retentionApi.createPolicy(formData);
      await fetchPolicies(formData.instanceId);
      setShowModal(false);
    } catch (error) {
      console.error('Failed to create policy', error);
      alert('Failed to create policy');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this retention policy?')) return;
    try {
      await retentionApi.deletePolicy(id);
      await fetchPolicies(formData.instanceId);
    } catch (error) {
       console.error('Failed to delete policy', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h3 className="text-lg font-medium text-white">Table Retention Policies</h3>
           <p className="text-sm text-gray-400">Manage automated data deletion policies</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Policy
        </button>
      </div>

      <div className="flex items-center space-x-2">
        <label className="text-sm text-gray-300">Select Instance:</label>
        <select
          value={formData.instanceId}
          onChange={(e) => setFormData({ ...formData, instanceId: e.target.value })}
          className="bg-slate-800 border border-slate-700 text-white rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {instances.map((inst) => (
            <option key={inst.id} value={inst.id}>{inst.name} ({inst.host})</option>
          ))}
        </select>
      </div>

      <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
        <table className="w-full text-left">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Name</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Target</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Column</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Days</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Schedule</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
               <tr>
                 <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                   <div className="flex justify-center"><Loader2 className="animate-spin w-5 h-5 mr-2" /> Loading...</div>
                 </td>
               </tr>
            ) : policies.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No retention policies found for this instance.
                </td>
              </tr>
            ) : (
              policies.map((policy) => (
                <tr key={policy.id} className="hover:bg-slate-800/30">
                  <td className="px-6 py-4 text-sm text-white">{policy.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {policy.taskPayload.schema}.{policy.taskPayload.table}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 font-mono">
                    {policy.taskPayload.dateColumn}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {policy.taskPayload.retentionDays}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    <span className="flex items-center">
                       <CalendarClock className="w-3 h-3 mr-1 text-gray-500" />
                       {policy.cronExpression}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDelete(policy.id)}
                      className="text-red-400 hover:text-red-300 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">Add Retention Policy</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Table Name</label>
                <input
                  type="text"
                  value={formData.table}
                  onChange={(e) => setFormData({ ...formData, table: e.target.value })}
                  placeholder="e.g. audit_logs"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm text-gray-400 mb-1">Schema</label>
                    <input
                      type="text"
                      value={formData.schema}
                      onChange={(e) => setFormData({ ...formData, schema: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-sm text-gray-400 mb-1">Retention (Days)</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.retentionDays}
                      onChange={(e) => setFormData({ ...formData, retentionDays: parseInt(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                 </div>
              </div>

               <div>
                <label className="block text-sm text-gray-400 mb-1">Date Column</label>
                <input
                  type="text"
                  value={formData.dateColumn}
                  onChange={(e) => setFormData({ ...formData, dateColumn: e.target.value })}
                  placeholder="e.g. created_at"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Must be a timestamp/date column.</p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Cron Schedule</label>
                <input
                  type="text"
                  value={formData.cronExpression}
                  onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                  placeholder="0 0 * * *"
                  className="w-full bg-slate-800 text-sm font-mono border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formData.table || !formData.dateColumn}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {creating ? 'Creating...' : 'Create Policy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
