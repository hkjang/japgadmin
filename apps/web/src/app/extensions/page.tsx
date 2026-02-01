'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { extensionApi } from '@/lib/api';
import { toast } from 'sonner';
import { Search, Plus, Trash2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Extension {
  name: string;
  default_version: string;
  installed_version: string | null;
  comment: string;
}

export default function ExtensionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);

  // Fetch extensions
  const { data: extensions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['extensions'],
    queryFn: async () => {
      const response = await extensionApi.getExtensions();
      return response.data;
    },
  });

  // Install mutation
  const installMutation = useMutation({
    mutationFn: async (data: { name: string; schema?: string; version?: string }) => {
      await extensionApi.installExtension(data);
    },
    onSuccess: () => {
      toast.success(t('extensionInstalled', 'Extension installed successfully'));
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
      setInstallModalOpen(false);
      setSelectedExtension(null);
    },
    onError: (error: any) => {
      toast.error(t('extensionInstallFailed', 'Failed to install extension: ' + (error.response?.data?.message || error.message)));
    },
  });

  // Uninstall mutation
  const uninstallMutation = useMutation({
    mutationFn: async (name: string) => {
      await extensionApi.removeExtension(name);
    },
    onSuccess: () => {
      toast.success(t('extensionUninstalled', 'Extension uninstalled successfully'));
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
    },
    onError: (error: any) => {
      toast.error(t('extensionUninstallFailed', 'Failed to uninstall extension: ' + (error.response?.data?.message || error.message)));
    },
  });

  const handleInstall = (extension: Extension) => {
    // For now simple install without specific schema/version selection UI
    if (confirm(`Are you sure you want to install ${extension.name}?`)) {
        installMutation.mutate({ name: extension.name });
    }
  };

  const handleUninstall = (name: string) => {
    if (confirm(`Are you sure you want to uninstall ${name}? This might affect dependent objects.`)) {
      uninstallMutation.mutate(name);
    }
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
            {t('extensions', 'Extensions')}
          </h1>
          <p className="text-gray-400 mt-1">
            {t('extensionsDesc', 'Manage PostgreSQL extensions for your database.')}
          </p>
        </div>
        <div className="flex items-center gap-3">
            <button 
                onClick={() => refetch()}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                title={t('refresh', 'Refresh')}
            >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 items-center bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchExtensions', 'Search extensions...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-postgres-500 transition-colors"
          />
        </div>
      </div>

      {/* Extensions List */}
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
                <p>{t('errorLoadingExtensions', 'Failed to load extensions.')}</p>
            </div>
        ) : filteredExtensions.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center p-12 text-center text-gray-500">
                <Search className="w-12 h-12 mb-4 opacity-50" />
                <p>{t('noExtensionsFound', 'No extensions found matching your search.')}</p>
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
                            Installed {ext.installed_version !== ext.default_version && `(v${ext.installed_version})`}
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
                    {uninstallMutation.isPending ? 'Uninstalling...' : 'Uninstall'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleInstall(ext)}
                    disabled={installMutation.isPending}
                    className="flex items-center gap-2 text-xs font-medium text-postgres-400 group-hover:text-postgres-300 transition-colors disabled:opacity-50 ml-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {installMutation.isPending ? 'Installing...' : 'Install'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
