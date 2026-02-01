'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

interface SidebarProps {
  onCommandOpen: () => void;
}

type NavCategory = {
  title: string;
  items: {
    name: string;
    path: string;
    icon: string;
  }[];
};

export default function Sidebar({ onCommandOpen }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  
  // 카테고리별 접기/펼치기 상태 관리 (기본값: 모두 펼침)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'overview': true,
    'data': true,
    'operations': true,
    'analysis': true,
    'system': true,
  });

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const categories: Record<string, NavCategory> = {
    overview: {
      title: '개요',
      items: [
        { name: t('dashboard'), path: '/', icon: '📊' },
        { name: t('monitoring'), path: '/monitoring', icon: '📈' },
      ]
    },
    data: {
      title: '데이터 관리',
      items: [
        { name: '인벤토리', path: '/inventory', icon: '🗄️' },
        { name: '스키마', path: '/schema', icon: '🗂️' },
        { name: '세션', path: '/sessions', icon: '👥' },
      ]
    },
    operations: {
      title: '운영',
      items: [
        { name: '콘솔', path: '/console', icon: '💻' },
        { name: t('vacuum'), path: '/vacuum', icon: '🧹' },
        { name: '백업', path: '/backup', icon: '💾' },
        { name: '복제', path: '/replication', icon: '🔄' },
      ]
    },
    analysis: {
      title: '분석',
      items: [
        { name: t('query'), path: '/query', icon: '🔍' },
      ]
    },
    system: {
      title: '시스템',
      items: [
        { name: '관리자', path: '/admin', icon: '👤' },
        { name: t('settings'), path: '/settings', icon: '⚙️' },
        { name: '확장', path: '/extensions', icon: '🧩' },
      ]
    }
  };

  return (
    <aside className="w-64 glass-header min-h-screen p-4 flex flex-col no-scrollbar overflow-y-auto">
      {/* Logo */}
      <SidebarLogo />

      {/* Navigation */}
      <nav className="flex-1 space-y-6">
        {Object.entries(categories).map(([key, category]) => (
          <div key={key}>
            <button
              onClick={() => toggleCategory(key)}
              className="flex items-center w-full text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 hover:text-gray-300 transition-colors"
            >
              <span>{category.title}</span>
              <span className="ml-auto text-xs">
                {expandedCategories[key] ? '−' : '+'}
              </span>
            </button>
            
            {expandedCategories[key] && (
              <div className="space-y-1">
                {category.items.map((item) => {
                  const isActive = pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                        isActive 
                          ? 'bg-postgres-500/20 text-postgres-200 shadow-sm border border-postgres-500/30' 
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="font-medium">{item.name}</span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-postgres-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <SidebarFooter onCommandOpen={onCommandOpen} />
    </aside>
  );
}

function SidebarLogo() {
  return (
    <div className="mb-8 px-2">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <span className="text-2xl">🐘</span>
        <span className="bg-gradient-to-r from-postgres-300 to-postgres-500 bg-clip-text text-transparent">
          JAPG Admin
        </span>
      </h1>
      <p className="text-xs text-gray-500 mt-1 ml-9">PostgreSQL Management</p>
    </div>
  );
}

function SidebarFooter({ onCommandOpen }: { onCommandOpen: () => void }) {
  return (
    <div className="mt-auto pt-6 border-t border-white/10 space-y-3">
      <button
        onClick={onCommandOpen}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-gray-700"
      >
        <span className="flex items-center gap-2">
          <span>🔍</span>
          <span>명령어 검색</span>
        </span>
        <kbd className="px-1.5 py-0.5 text-xs bg-gray-800 rounded font-mono border border-gray-700">⌘K</kbd>
      </button>
      
      <SystemStatus />
    </div>
  );
}

function SystemStatus() {
  const { t } = useTranslation();
  
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 px-3">
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </div>
      <span>{t('systemOnline')}</span>
      <span className="ml-auto text-gray-600">v1.0.0</span>
    </div>
  );
}
