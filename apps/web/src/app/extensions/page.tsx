'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { extensionApi, inventoryApi } from '@/lib/api';
import { toast } from 'sonner';
import { Search, Plus, Trash2, CheckCircle, AlertCircle, RefreshCw, Server, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';



interface Extension {
  name: string;
  default_version: string;
  installed_version: string | null;
  comment: string;
}

interface Instance {
    id: string;
    name: string;
    status: string;
}

export default function ExtensionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [sqlContent, setSqlContent] = useState('');
  
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');

  // Fetch instances
  const { data: instancesData } = useQuery({
      queryKey: ['instances'],
      queryFn: async () => {
          const response = await inventoryApi.getInstances();
          return response.data;
      },
  });

  const instances = instancesData?.instances || [];

  // Set default instance if not selected
  if (!selectedInstanceId && instances.length > 0) {
      setSelectedInstanceId(instances[0].id);
  }

  // Fetch extensions
  const { data: extensions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['extensions', selectedInstanceId],
    queryFn: async () => {
      if (!selectedInstanceId) return [];
      const response = await extensionApi.getExtensions(selectedInstanceId);
      return response.data;
    },
    enabled: !!selectedInstanceId,
  });

  // Install mutation
  const installMutation = useMutation({
    mutationFn: async (data: { name: string; schema?: string; version?: string }) => {
      if (!selectedInstanceId) return;
      await extensionApi.installExtension({ ...data, instanceId: selectedInstanceId });
    },
    onSuccess: () => {
      toast.success(t('extensionsPage.installSuccess'));
      queryClient.invalidateQueries({ queryKey: ['extensions', selectedInstanceId] });
      setInstallModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(t('extensionsPage.installFail') + (error.response?.data?.message || error.message));
    },
  });

  // Uninstall mutation
  const uninstallMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!selectedInstanceId) return;
      await extensionApi.removeExtension(selectedInstanceId, name);
    },
    onSuccess: () => {
      toast.success(t('extensionsPage.uninstallSuccess'));
      queryClient.invalidateQueries({ queryKey: ['extensions', selectedInstanceId] });
    },
    onError: (error: any) => {
      toast.error(t('extensionsPage.uninstallFail') + (error.response?.data?.message || error.message));
    },
  });

  // Offline install mutation
  const offlineInstallMutation = useMutation({
      mutationFn: async (sql: string) => {
          if (!selectedInstanceId) return;
          await extensionApi.installExtensionFromSql(selectedInstanceId, sql);
      },
      onSuccess: () => {
          toast.success(t('extensionsPage.installSuccess'));
          setOfflineModalOpen(false);
          setSqlContent('');
          queryClient.invalidateQueries({ queryKey: ['extensions', selectedInstanceId] });
      },
      onError: (error: any) => {
          toast.error(t('extensionsPage.installFail') + (error.response?.data?.message || error.message));
      }
  });

  const handleInstall = (extension: Extension) => {
    if (confirm(t('extensionsPage.confirmInstall') + ` (${extension.name})`)) {
        installMutation.mutate({ name: extension.name });
    }
  };

  const handleUninstall = (name: string) => {
    if (confirm(t('extensionsPage.confirmUninstall') + ` (${name})`)) {
      uninstallMutation.mutate(name);
    }
  };

  const handleOfflineSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!sqlContent.trim()) return;
      offlineInstallMutation.mutate(sqlContent);
  };

  const filteredExtensions = extensions.filter((ext: Extension) =>
    ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ext.comment.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {t('extensionsPage.title')}
          </h1>
          <p className="text-gray-400 mt-1">
            {t('extensionsPage.subtitle')}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
             {/* Instance Selector */}
             <div className="relative">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                    value={selectedInstanceId}
                    onChange={(e) => setSelectedInstanceId(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-8 py-2 text-sm text-white focus:outline-none focus:border-postgres-500 appearance-none min-w-[200px]"
                >
                    <option value="" disabled>{t('extensionsPage.selectInstance')}</option>
                    {instances.map((inst: Instance) => (
                        <option key={inst.id} value={inst.id} className="text-black">
                            {inst.name} ({inst.status})
                        </option>
                    ))}
                </select>
            </div>

             <button 
                onClick={() => setOfflineModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10"
            >
                <Upload className="w-4 h-4" />
                <span>{t('extensionsPage.offlineInstall')}</span>
            </button>

            <button 
                onClick={() => refetch()}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                title={t('extensionsPage.refresh')}
            >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>

      {/* Warning if no instance selected */}
      {!selectedInstanceId && (
           <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 p-4 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{t('extensionsPage.noInstanceSelected')}</p>
           </div>
      )}

      {/* Search */}
      {selectedInstanceId && (
        <div className="flex gap-4 items-center bg-white/5 p-4 rounded-xl border border-white/10">
            <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
                type="text"
                placeholder={t('extensionsPage.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-postgres-500 transition-colors"
            />
            </div>
        </div>
      )}

      {/* Extensions List */}
      {selectedInstanceId && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
                // Loading Skeletons
                Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="bg-white/5 rounded-xl border border-white/10 p-6 h-40 animate-pulse">
                        <div className="h-6 w-1/3 bg-white/10 rounded mb-4"></div>
                        <div className="h-4 w-full bg-white/10 rounded mb-2"></div>
                        <div className="h-4 w-2/3 bg-white/10 rounded"></div>
                    </div>
                ))
            ) : isError ? (
                <div className="col-span-full flex flex-col items-center justify-center p-12 text-center text-red-400">
                    <AlertCircle className="w-12 h-12 mb-4" />
                    <p>{t('extensionsPage.errorLoading')}</p>
                </div>
            ) : filteredExtensions.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center p-12 text-center text-gray-500">
                    <Search className="w-12 h-12 mb-4 opacity-50" />
                    <p>{t('extensionsPage.noExtensionsFound')}</p>
                </div>
            ) : (
            filteredExtensions.map((ext: Extension) => (
                <div
                key={ext.name}
                className={`
                    group relative bg-white/5 backdrop-blur-sm rounded-xl border p-6 transition-all duration-200
                    ${ext.installed_version 
                        ? 'border-green-500/30 hover:border-green-500/50 hover:bg-green-500/5' 
                        : 'border-white/10 hover:border-white/20 hover:bg-white/10'
                    }
                `}
                >
                <div className="flex justify-between items-start mb-4">
                    <div>
                    <h3 className="text-lg font-semibold text-white group-hover:text-postgres-300 transition-colors">
                        {ext.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/5">
                        v{ext.default_version}
                        </span>
                        {ext.installed_version && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/20 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                {t('extensionsPage.installed')} {ext.installed_version !== ext.default_version && `(v${ext.installed_version})`}
                            </span>
                        )}
                    </div>
                    </div>
                </div>
                
                <p className="text-sm text-gray-400 line-clamp-2 h-10 mb-6" title={ext.comment}>
                    {ext.comment}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    {ext.installed_version ? (
                    <button
                        onClick={() => handleUninstall(ext.name)}
                        disabled={uninstallMutation.isPending}
                        className="flex items-center gap-2 text-xs font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        {uninstallMutation.isPending ? t('extensionsPage.uninstalling') : t('extensionsPage.uninstall')}
                    </button>
                    ) : (
                    <button
                        onClick={() => handleInstall(ext)}
                        disabled={installMutation.isPending}
                        className="flex items-center gap-2 text-xs font-medium text-postgres-400 group-hover:text-postgres-300 transition-colors disabled:opacity-50 ml-auto"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        {installMutation.isPending ? t('extensionsPage.installing') : t('extensionsPage.install')}
                    </button>
                    )}
                </div>
                </div>
            ))
            )}
        </div>
      )}

      {/* Offline Install Modal */}
      {offlineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-[#1e1e1e] rounded-xl border border-white/10 shadow-2xl w-full max-w-2xl overflow-hidden">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">{t('extensionsPage.offlineModalTitle')}</h2>
                    <button onClick={() => setOfflineModalOpen(false)} className="text-gray-400 hover:text-white">
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>
                
                <form onSubmit={handleOfflineSubmit} className="p-6 space-y-4">
                    <div className="bg-blue-500/10 border border-blue-500/20 text-blue-200 p-4 rounded-lg text-sm">
                        <p className="font-semibold mb-1">{t('extensionsPage.offlineModalTip')}</p>
                        <p>{t('extensionsPage.offlineModalTipText')}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('extensionsPage.sqlContent')}</label>
                        <textarea
                            value={sqlContent}
                            onChange={(e) => setSqlContent(e.target.value)}
                            className="w-full h-64 bg-black/40 border border-white/10 rounded-lg p-3 text-sm font-mono text-gray-200 focus:outline-none focus:border-postgres-500 resize-none"
                            placeholder={t('extensionsPage.sqlClobPlaceholder')}
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setOfflineModalOpen(false)}
                            className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            {t('extensionsPage.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={offlineInstallMutation.isPending || !sqlContent.trim()}
                            className="px-4 py-2 rounded-lg bg-postgres-600 hover:bg-postgres-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {offlineInstallMutation.isPending ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    {t('extensionsPage.installing')}
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    {t('extensionsPage.executeInstall')}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
