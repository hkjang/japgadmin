'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { extensionApi, inventoryApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Search, Plus, Trash2, CheckCircle, AlertCircle, RefreshCw, Server, Upload,
  Package, ArrowUpCircle, ExternalLink, Database, Shield, Clock, Filter,
  LayoutGrid, List, Info, X, ChevronDown, ChevronUp, Puzzle, Zap, Star
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Extension {
  name: string;
  default_version: string;
  installed_version: string | null;
  comment: string;
  category?: string;
  requires?: string[];
  schema?: string;
}

interface Instance {
  id: string;
  name: string;
  status: string;
}

type ViewMode = 'grid' | 'list';
type TabFilter = 'all' | 'installed' | 'available';

const EXTENSION_CATEGORIES: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  'data_types': { label: '데이터 타입', icon: <Database className="w-4 h-4" />, color: 'blue' },
  'indexing': { label: '인덱싱', icon: <Zap className="w-4 h-4" />, color: 'yellow' },
  'full_text_search': { label: '전문 검색', icon: <Search className="w-4 h-4" />, color: 'purple' },
  'security': { label: '보안', icon: <Shield className="w-4 h-4" />, color: 'red' },
  'monitoring': { label: '모니터링', icon: <Clock className="w-4 h-4" />, color: 'green' },
  'utilities': { label: '유틸리티', icon: <Package className="w-4 h-4" />, color: 'gray' },
  'foreign_data': { label: '외부 데이터', icon: <ExternalLink className="w-4 h-4" />, color: 'cyan' },
  'other': { label: '기타', icon: <Puzzle className="w-4 h-4" />, color: 'slate' },
};

const POPULAR_EXTENSIONS = ['pg_stat_statements', 'pgcrypto', 'uuid-ossp', 'hstore', 'pg_trgm', 'postgis', 'ltree', 'citext'];

function getExtensionCategory(name: string, comment: string): string {
  const lowerName = name.toLowerCase();
  const lowerComment = comment.toLowerCase();

  if (lowerName.includes('crypto') || lowerName.includes('ssl') || lowerComment.includes('encrypt')) return 'security';
  if (lowerName.includes('stat') || lowerComment.includes('monitor') || lowerComment.includes('statistic')) return 'monitoring';
  if (lowerName.includes('fts') || lowerName.includes('trgm') || lowerComment.includes('text search') || lowerComment.includes('full-text')) return 'full_text_search';
  if (lowerName.includes('btree') || lowerName.includes('gin') || lowerName.includes('gist') || lowerComment.includes('index')) return 'indexing';
  if (lowerName.includes('fdw') || lowerComment.includes('foreign')) return 'foreign_data';
  if (lowerName.includes('uuid') || lowerName.includes('hstore') || lowerName.includes('json') || lowerComment.includes('data type')) return 'data_types';
  if (lowerComment.includes('utility') || lowerComment.includes('function')) return 'utilities';
  return 'other';
}

function getCategoryColor(color: string): string {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    slate: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  return colors[color] || colors.gray;
}

export default function ExtensionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const [sqlContent, setSqlContent] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'popularity' | 'recent'>('name');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [tabFilter, setTabFilter] = useState<TabFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

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
    queryKey: ['extensions', selectedInstanceId, sortBy],
    queryFn: async () => {
      if (!selectedInstanceId) return [];
      const response = await extensionApi.getExtensions(selectedInstanceId, sortBy);
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
      queryClient.invalidateQueries({ queryKey: ['extensions', selectedInstanceId, sortBy] });
      setDetailModalOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ['extensions', selectedInstanceId, sortBy] });
      setDetailModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(t('extensionsPage.uninstallFail') + (error.response?.data?.message || error.message));
    },
  });

  // Upgrade mutation
  const upgradeMutation = useMutation({
    mutationFn: async (data: { name: string; version: string }) => {
      if (!selectedInstanceId) return;
      await extensionApi.installExtension({ ...data, instanceId: selectedInstanceId });
    },
    onSuccess: () => {
      toast.success(t('extensionsPage.upgradeSuccess'));
      queryClient.invalidateQueries({ queryKey: ['extensions', selectedInstanceId, sortBy] });
    },
    onError: (error: any) => {
      toast.error(t('extensionsPage.upgradeFail') + (error.response?.data?.message || error.message));
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
      queryClient.invalidateQueries({ queryKey: ['extensions', selectedInstanceId, sortBy] });
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

  const handleUpgrade = (extension: Extension) => {
    if (confirm(t('extensionsPage.confirmUpgrade') + ` (${extension.name} ${extension.installed_version} → ${extension.default_version})`)) {
      upgradeMutation.mutate({ name: extension.name, version: extension.default_version });
    }
  };

  const handleOfflineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sqlContent.trim()) return;
    offlineInstallMutation.mutate(sqlContent);
  };

  const openDetailModal = (ext: Extension) => {
    setSelectedExtension(ext);
    setDetailModalOpen(true);
  };

  // Filter and categorize extensions
  const { filteredExtensions, stats, categoryStats } = useMemo(() => {
    let filtered = extensions.filter((ext: Extension) =>
      ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ext.comment.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Tab filter
    if (tabFilter === 'installed') {
      filtered = filtered.filter((ext: Extension) => ext.installed_version);
    } else if (tabFilter === 'available') {
      filtered = filtered.filter((ext: Extension) => !ext.installed_version);
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((ext: Extension) =>
        getExtensionCategory(ext.name, ext.comment) === selectedCategory
      );
    }

    // Calculate stats
    const installed = extensions.filter((ext: Extension) => ext.installed_version).length;
    const available = extensions.length - installed;
    const upgradable = extensions.filter((ext: Extension) =>
      ext.installed_version && ext.installed_version !== ext.default_version
    ).length;

    // Category stats
    const catStats: Record<string, number> = {};
    extensions.forEach((ext: Extension) => {
      const cat = getExtensionCategory(ext.name, ext.comment);
      catStats[cat] = (catStats[cat] || 0) + 1;
    });

    return {
      filteredExtensions: filtered,
      stats: { total: extensions.length, installed, available, upgradable },
      categoryStats: catStats,
    };
  }, [extensions, searchQuery, tabFilter, selectedCategory]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-postgres-500/20 to-blue-500/20 border border-postgres-500/30">
              <Puzzle className="w-6 h-6 text-postgres-400" />
            </div>
            {t('extensionsPage.title')}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {t('extensionsPage.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Instance Selector */}
          <div className="relative">
            <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-8 py-2 text-sm text-white focus:outline-none focus:border-postgres-500 appearance-none min-w-[180px]"
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
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10 text-sm"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{t('extensionsPage.offlineInstall')}</span>
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

      {selectedInstanceId && (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Package className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-gray-400">{t('extensionsPage.totalExtensions')}</p>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.installed}</p>
                <p className="text-xs text-gray-400">{t('extensionsPage.installedCount')}</p>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-500/20">
                <Plus className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.available}</p>
                <p className="text-xs text-gray-400">{t('extensionsPage.availableCount')}</p>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <ArrowUpCircle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.upgradable}</p>
                <p className="text-xs text-gray-400">{t('extensionsPage.upgradableCount')}</p>
              </div>
            </div>
          </div>

          {/* Tabs and Filters */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
            {/* Tab Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1">
                <button
                  onClick={() => setTabFilter('all')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    tabFilter === 'all'
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t('extensionsPage.tabAll')} ({stats.total})
                </button>
                <button
                  onClick={() => setTabFilter('installed')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    tabFilter === 'installed'
                      ? 'bg-green-500/20 text-green-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t('extensionsPage.tabInstalled')} ({stats.installed})
                </button>
                <button
                  onClick={() => setTabFilter('available')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    tabFilter === 'available'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t('extensionsPage.tabAvailable')} ({stats.available})
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-all ${
                      viewMode === 'grid'
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-all ${
                      viewMode === 'list'
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
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

              {/* Category Filter */}
              <div className="relative">
                <button
                  onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                  className="flex items-center gap-2 px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-sm text-white hover:border-white/20 transition-colors min-w-[150px]"
                >
                  <Filter className="w-4 h-4 text-gray-400" />
                  <span className="flex-1 text-left">
                    {selectedCategory === 'all' ? t('extensionsPage.allCategories') : EXTENSION_CATEGORIES[selectedCategory]?.label || selectedCategory}
                  </span>
                  {showCategoryFilter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showCategoryFilter && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-[#1e1e1e] border border-white/10 rounded-lg shadow-xl z-20 py-1">
                    <button
                      onClick={() => { setSelectedCategory('all'); setShowCategoryFilter(false); }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2 ${
                        selectedCategory === 'all' ? 'text-white bg-white/5' : 'text-gray-400'
                      }`}
                    >
                      <Package className="w-4 h-4" />
                      {t('extensionsPage.allCategories')}
                      <span className="ml-auto text-xs opacity-60">{stats.total}</span>
                    </button>
                    {Object.entries(EXTENSION_CATEGORIES).map(([key, cat]) => (
                      <button
                        key={key}
                        onClick={() => { setSelectedCategory(key); setShowCategoryFilter(false); }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2 ${
                          selectedCategory === key ? 'text-white bg-white/5' : 'text-gray-400'
                        }`}
                      >
                        {cat.icon}
                        {cat.label}
                        <span className="ml-auto text-xs opacity-60">{categoryStats[key] || 0}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sort Select */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'popularity' | 'recent')}
                className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-postgres-500 appearance-none min-w-[140px]"
                aria-label={t('extensionsPage.sortBy')}
              >
                <option value="name" className="text-black">{t('extensionsPage.sortByName')}</option>
                <option value="popularity" className="text-black">{t('extensionsPage.sortByPopularity')}</option>
                <option value="recent" className="text-black">{t('extensionsPage.sortByRecent')}</option>
              </select>
            </div>
          </div>

          {/* Extensions Display */}
          {isLoading ? (
            <div className={viewMode === 'grid'
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-2"
            }>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="bg-white/5 rounded-xl border border-white/10 p-5 animate-pulse">
                  <div className="h-5 w-1/3 bg-white/10 rounded mb-3"></div>
                  <div className="h-4 w-full bg-white/10 rounded mb-2"></div>
                  <div className="h-4 w-2/3 bg-white/10 rounded"></div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-red-400 bg-white/5 rounded-xl border border-white/10">
              <AlertCircle className="w-12 h-12 mb-4" />
              <p>{t('extensionsPage.errorLoading')}</p>
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
              >
                {t('extensionsPage.retry')}
              </button>
            </div>
          ) : filteredExtensions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 bg-white/5 rounded-xl border border-white/10">
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p>{t('extensionsPage.noExtensionsFound')}</p>
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExtensions.map((ext: Extension) => {
                const category = getExtensionCategory(ext.name, ext.comment);
                const categoryInfo = EXTENSION_CATEGORIES[category];
                const isPopular = POPULAR_EXTENSIONS.includes(ext.name);
                const hasUpgrade = ext.installed_version && ext.installed_version !== ext.default_version;

                return (
                  <div
                    key={ext.name}
                    onClick={() => openDetailModal(ext)}
                    className={`
                      group relative bg-white/5 backdrop-blur-sm rounded-xl border p-5 transition-all duration-200 cursor-pointer
                      ${ext.installed_version
                        ? 'border-green-500/30 hover:border-green-500/50 hover:bg-green-500/5'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/10'
                      }
                    `}
                  >
                    {/* Popular Badge */}
                    {isPopular && (
                      <div className="absolute -top-2 -right-2">
                        <div className="p-1 rounded-full bg-yellow-500/20 border border-yellow-500/30">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        </div>
                      </div>
                    )}

                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-white group-hover:text-postgres-300 transition-colors truncate">
                          {ext.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {/* Category Badge */}
                          <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${getCategoryColor(categoryInfo?.color || 'gray')}`}>
                            {categoryInfo?.icon}
                            {categoryInfo?.label || category}
                          </span>

                          {/* Version */}
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/5">
                            v{ext.default_version}
                          </span>

                          {/* Installed Badge */}
                          {ext.installed_version && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/20 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              {t('extensionsPage.installed')}
                            </span>
                          )}

                          {/* Upgrade Badge */}
                          {hasUpgrade && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/20 flex items-center gap-1">
                              <ArrowUpCircle className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-400 line-clamp-2 h-10 mb-4" title={ext.comment}>
                      {ext.comment || t('extensionsPage.noDescription')}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <button
                        onClick={(e) => { e.stopPropagation(); openDetailModal(ext); }}
                        className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                      >
                        <Info className="w-3.5 h-3.5" />
                        {t('extensionsPage.details')}
                      </button>

                      {ext.installed_version ? (
                        <div className="flex items-center gap-2">
                          {hasUpgrade && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUpgrade(ext); }}
                              disabled={upgradeMutation.isPending}
                              className="flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50"
                            >
                              <ArrowUpCircle className="w-3.5 h-3.5" />
                              {t('extensionsPage.upgrade')}
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUninstall(ext.name); }}
                            disabled={uninstallMutation.isPending}
                            className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {uninstallMutation.isPending ? t('extensionsPage.uninstalling') : t('extensionsPage.uninstall')}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleInstall(ext); }}
                          disabled={installMutation.isPending}
                          className="flex items-center gap-1 text-xs font-medium text-postgres-400 hover:text-postgres-300 transition-colors disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {installMutation.isPending ? t('extensionsPage.installing') : t('extensionsPage.install')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-black/20">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('extensionsPage.extensionName')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">{t('extensionsPage.category')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('extensionsPage.version')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('extensionsPage.status')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">{t('extensionsPage.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredExtensions.map((ext: Extension) => {
                    const category = getExtensionCategory(ext.name, ext.comment);
                    const categoryInfo = EXTENSION_CATEGORIES[category];
                    const hasUpgrade = ext.installed_version && ext.installed_version !== ext.default_version;

                    return (
                      <tr
                        key={ext.name}
                        onClick={() => openDetailModal(ext)}
                        className="hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{ext.name}</span>
                            {POPULAR_EXTENSIONS.includes(ext.name) && (
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate max-w-xs">{ext.comment}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 w-fit ${getCategoryColor(categoryInfo?.color || 'gray')}`}>
                            {categoryInfo?.icon}
                            {categoryInfo?.label || category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-300">v{ext.default_version}</span>
                          {ext.installed_version && ext.installed_version !== ext.default_version && (
                            <span className="text-xs text-gray-500 ml-1">(v{ext.installed_version})</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {ext.installed_version ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/20 flex items-center gap-1 w-fit">
                                <CheckCircle className="w-3 h-3" />
                                {t('extensionsPage.installed')}
                              </span>
                              {hasUpgrade && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/20 flex items-center gap-1 w-fit">
                                  <ArrowUpCircle className="w-3 h-3" />
                                  {t('extensionsPage.updateAvailable')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">{t('extensionsPage.notInstalled')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {ext.installed_version ? (
                              <>
                                {hasUpgrade && (
                                  <button
                                    onClick={() => handleUpgrade(ext)}
                                    disabled={upgradeMutation.isPending}
                                    className="p-1.5 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded transition-colors disabled:opacity-50"
                                    title={t('extensionsPage.upgrade')}
                                  >
                                    <ArrowUpCircle className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleUninstall(ext.name)}
                                  disabled={uninstallMutation.isPending}
                                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                                  title={t('extensionsPage.uninstall')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleInstall(ext)}
                                disabled={installMutation.isPending}
                                className="p-1.5 text-postgres-400 hover:text-postgres-300 hover:bg-postgres-500/10 rounded transition-colors disabled:opacity-50"
                                title={t('extensionsPage.install')}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {detailModalOpen && selectedExtension && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-white/10 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{selectedExtension.name}</h2>
                  {POPULAR_EXTENSIONS.includes(selectedExtension.name) && (
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {(() => {
                    const category = getExtensionCategory(selectedExtension.name, selectedExtension.comment);
                    const categoryInfo = EXTENSION_CATEGORIES[category];
                    return (
                      <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${getCategoryColor(categoryInfo?.color || 'gray')}`}>
                        {categoryInfo?.icon}
                        {categoryInfo?.label || category}
                      </span>
                    );
                  })()}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/5">
                    v{selectedExtension.default_version}
                  </span>
                </div>
              </div>
              <button onClick={() => setDetailModalOpen(false)} className="text-gray-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-sm text-gray-400">{t('extensionsPage.status')}</span>
                {selectedExtension.installed_version ? (
                  <span className="text-sm text-green-400 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    {t('extensionsPage.installed')} (v{selectedExtension.installed_version})
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">{t('extensionsPage.notInstalled')}</span>
                )}
              </div>

              {/* Description */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">{t('extensionsPage.description')}</h4>
                <p className="text-sm text-gray-400">
                  {selectedExtension.comment || t('extensionsPage.noDescription')}
                </p>
              </div>

              {/* Version Info */}
              {selectedExtension.installed_version && selectedExtension.installed_version !== selectedExtension.default_version && (
                <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-400">
                    <ArrowUpCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{t('extensionsPage.updateAvailable')}</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    {selectedExtension.installed_version} → {selectedExtension.default_version}
                  </p>
                </div>
              )}

              {/* Documentation Link */}
              <div>
                <a
                  href={`https://www.postgresql.org/docs/current/${selectedExtension.name}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-postgres-400 hover:text-postgres-300 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('extensionsPage.viewDocumentation')}
                </a>
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                {t('extensionsPage.close')}
              </button>

              {selectedExtension.installed_version ? (
                <>
                  {selectedExtension.installed_version !== selectedExtension.default_version && (
                    <button
                      onClick={() => handleUpgrade(selectedExtension)}
                      disabled={upgradeMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {upgradeMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowUpCircle className="w-4 h-4" />
                      )}
                      {t('extensionsPage.upgrade')}
                    </button>
                  )}
                  <button
                    onClick={() => handleUninstall(selectedExtension.name)}
                    disabled={uninstallMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {uninstallMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {t('extensionsPage.uninstall')}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleInstall(selectedExtension)}
                  disabled={installMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-postgres-600 hover:bg-postgres-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {installMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {t('extensionsPage.install')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Offline Install Modal */}
      {offlineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">{t('extensionsPage.offlineModalTitle')}</h2>
              <button onClick={() => setOfflineModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOfflineSubmit} className="p-5 space-y-4">
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
