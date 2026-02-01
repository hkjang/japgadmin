'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { retentionApi, inventoryApi, schemaApi } from '@/lib/api';
import { Loader2, Trash2, Plus, CalendarClock } from 'lucide-react';

export default function RetentionPage() {
  const { t } = useTranslation();
  const [policies, setPolicies] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // Selection state
  const [selectedInstance, setSelectedInstance] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    instanceId: '',
    schema: 'public',
    table: '',
    dateColumn: '',
    retentionDays: 30,
    cronExpression: '0 0 * * *',
  });
  
  // Dropdown data options
  const [tables, setTables] = useState<any[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  
  // Column handling
  const [columns, setColumns] = useState<any[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);

  const [creating, setCreating] = useState(false);

  // 1. Fetch Instances
  useEffect(() => {
    inventoryApi.getInstances().then((res) => {
      const instancesList = res.data.instances || [];
      setInstances(instancesList);
      if (instancesList.length > 0) {
        const firstId = instancesList[0].id;
        setSelectedInstance(firstId);
        setFormData(prev => ({ ...prev, instanceId: firstId }));
      }
    });
  }, []);

  // 2. Fetch Policies when Selected Instance Changes
  useEffect(() => {
    if (selectedInstance) {
      fetchPolicies(selectedInstance);
    }
  }, [selectedInstance]);

  // 3. Fetch Tables when Modal opens or Instance/Schema changes
  useEffect(() => {
    if (showModal && formData.instanceId) {
        fetchTables(formData.instanceId, formData.schema);
    }
  }, [showModal, formData.instanceId, formData.schema]);

  // 4. Fetch Columns when Table changes
  useEffect(() => {
    if (formData.instanceId && formData.schema && formData.table) {
      fetchColumns(formData.instanceId, formData.schema, formData.table);
    } else {
      setColumns([]);
      setFormData(prev => ({ ...prev, dateColumn: '' }));
    }
  }, [formData.instanceId, formData.schema, formData.table]);

  const fetchTables = async (instanceId: string, schema: string) => {
      setLoadingTables(true);
      try {
          const res = await schemaApi.getTables(instanceId, schema);
          setTables(res.data || []);
      } catch (error) {
          console.error("Failed to fetch tables", error);
          setTables([]);
      } finally {
          setLoadingTables(false);
      }
  };

  const fetchColumns = async (instanceId: string, schema: string, table: string) => {
    setLoadingColumns(true);
    try {
      const res = await schemaApi.getTableColumns(instanceId, schema, table);
      console.log('Fetched columns for', table, res.data);
      
      const allCols = res.data || [];
      
      // Identify date columns for sorting/highlighting
      const isDateCol = (col: any) => {
          const typeStr = (col.dataType || '').toLowerCase();
          const udtStr = (col.udtName || '').toLowerCase();
          const keywords = ['timestamp', 'date', 'time', 'created', 'updated'];
          return keywords.some(k => typeStr.includes(k) || udtStr.includes(k) || col.name.toLowerCase().includes(k));
      };

      // Sort: Date columns first, then alphabetical
      const sortedCols = [...allCols].sort((a, b) => {
          const aIsDate = isDateCol(a);
          const bIsDate = isDateCol(b);
          if (aIsDate && !bIsDate) return -1;
          if (!aIsDate && bIsDate) return 1;
          return a.name.localeCompare(b.name);
      });

      console.log('All columns:', sortedCols);
      setColumns(sortedCols);
      
      // Auto-select first date column if available and nothing selected
      const firstDateCol = sortedCols.find(isDateCol);
      if (firstDateCol && !formData.dateColumn) {
          setFormData(prev => ({...prev, dateColumn: firstDateCol.name}));
      }
    } catch (error) {
       console.error("Failed to fetch columns", error);
       setColumns([]);
    } finally {
       setLoadingColumns(false);
    }
  };

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
      await fetchPolicies(selectedInstance); // Refresh current view
      setShowModal(false);
      alert(t('retentionPage.creationSuccess'));
    } catch (error) {
      console.error('Failed to create policy', error);
      alert('Failed to create policy');
    } finally {
        setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('retentionPage.confirmDelete'))) return;
    try {
      await retentionApi.deletePolicy(id);
      await fetchPolicies(selectedInstance);
      alert(t('retentionPage.deletionSuccess'));
    } catch (error) {
       console.error('Failed to delete policy', error);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <header className="space-y-2">
        <h2 className="text-3xl font-bold text-white">{t('retentionPage.title')}</h2>
        <p className="text-gray-400">{t('retentionPage.subtitle')}</p>
      </header>

      <div className="max-w-7xl space-y-6">
          <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-lg">
            <div className="flex items-center space-x-4">
                 <label className="text-sm text-gray-300">{t('retentionPage.selectInstance')}:</label>
                <select
                value={selectedInstance}
                onChange={(e) => {
                    setSelectedInstance(e.target.value);
                    setFormData(prev => ({ ...prev, instanceId: e.target.value }));
                }}
                className="bg-slate-800 border border-slate-700 text-white rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                {instances.map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.name} ({inst.host})</option>
                ))}
                </select>
            </div>

            <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
            >
            <Plus className="w-4 h-4 mr-2" />
            {t('retentionPage.addPolicy')}
            </button>
          </div>

        <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
            <table className="w-full text-left">
            <thead className="bg-slate-800/50">
                <tr>
                <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">{t('retentionPage.addPolicy')}</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">{t('retentionPage.tableName')}</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">{t('retentionPage.dateColumn')}</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">{t('retentionPage.retentionDays')}</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">{t('retentionPage.schedule')}</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">{t('retentionPage.actions')}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
                {loading ? (
                <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    <div className="flex justify-center"><Loader2 className="animate-spin w-5 h-5 mr-2" /> {t('retentionPage.loading')}</div>
                    </td>
                </tr>
                ) : policies.length === 0 ? (
                <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {t('retentionPage.noPolicies')}
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
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">{t('retentionPage.createPolicy')}</h3>
            
            <div className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('retentionPage.selectSchema')}</label>
                    <input
                      type="text"
                      value={formData.schema}
                      onChange={(e) => setFormData({ ...formData, schema: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('retentionPage.retentionDays')}</label>
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
                <label className="block text-sm text-gray-400 mb-1">{t('retentionPage.selectTable')}</label>
                {loadingTables ? (
                    <div className="text-xs text-gray-500">Loading tables...</div>
                ) : (
                    <select
                        value={formData.table}
                        onChange={(e) => setFormData({ ...formData, table: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                        <option value="">-- Select Table --</option>
                        {tables.map((t) => (
                            <option key={t.name} value={t.name}>{t.name}</option>
                        ))}
                    </select>
                )}
              </div>

               <div>
                <label className="block text-sm text-gray-400 mb-1">{t('retentionPage.dateColumn')}</label>
                {loadingColumns ? (
                   <div className="text-xs text-gray-500">Loading columns...</div>
                ) : (
                  <select
                    value={formData.dateColumn}
                    onChange={(e) => setFormData({ ...formData, dateColumn: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    disabled={!formData.table}
                  >
                    <option value="">-- Select Date Column --</option>
                    {columns.map((col) => (
                      <option key={col.name} value={col.name}>{col.name} ({col.dataType})</option>
                    ))}
                  </select>
                )}
                {columns.length === 0 && formData.table && !loadingColumns && (
                   <p className="text-xs text-red-400 mt-1">No date/timestamp columns found in this table.</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('retentionPage.schedule')}</label>
                <input
                  type="text"
                  value={formData.cronExpression}
                  onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                  placeholder="0 0 * * *"
                  className="w-full bg-slate-800 text-sm font-mono border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            <div className="mt-4 p-4 bg-black/30 rounded text-xs font-mono text-gray-400 overflow-auto max-h-40">
                <p className="font-bold text-white mb-2">Debug Info:</p>
                <p>Selected Table: {formData.table}</p>
                <p>Columns Count: {columns.length}</p>
                <pre>{JSON.stringify(columns, null, 2)}</pre>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formData.table || !formData.dateColumn}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {creating ? 'Creating...' : t('retentionPage.createPolicy')}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
