'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  onCommandOpen: () => void;
}

export default function Sidebar({ onCommandOpen }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { name: '대시보드', path: '/', icon: '📊' },
    { name: '모니터링', path: '/monitoring', icon: '📈' },
    { name: 'Vacuum', path: '/vacuum', icon: '🧹' },
    { name: '쿼리 분석', path: '/query', icon: '🔍' },
    { name: '설정', path: '/settings', icon: '⚙️' },
  ];

  return (
    <aside className="w-64 glass-header min-h-screen p-6 flex flex-col">
      {/* Logo */}
      <SidebarLogo />

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`navbar-btn ${isActive ? 'active' : ''}`}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <SidebarFooter onCommandOpen={onCommandOpen} />
    </aside>
  );
}

function SidebarLogo() {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold bg-gradient-to-r from-postgres-400 to-postgres-600 bg-clip-text text-transparent">
        PostgreSQL
      </h1>
      <p className="text-sm text-gray-400 mt-1">Admin Tool</p>
    </div>
  );
}

function SidebarFooter({ onCommandOpen }: { onCommandOpen: () => void }) {
  return (
    <div className="mt-auto pt-6 border-t border-white/10 space-y-3">
      <button
        onClick={onCommandOpen}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>🔍</span>
          <span>명령어 검색</span>
        </span>
        <kbd className="px-2 py-1 text-xs bg-gray-800 rounded">⌘K</kbd>
      </button>
      
      <SystemStatus />
    </div>
  );
}

function SystemStatus() {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400 px-3">
      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
      <span>시스템 온라인</span>
    </div>
  );
}
