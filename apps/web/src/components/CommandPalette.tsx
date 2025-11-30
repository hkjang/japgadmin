'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { Command } from 'cmdk';
import { toast } from 'sonner';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  // 페이지 명령
  const pages = [
    { name: '대시보드', path: '/', icon: '📊', keywords: ['dashboard', 'home'] },
    { name: '모니터링', path: '/monitoring', icon: '📈', keywords: ['monitor', 'activity', 'lock'] },
    { name: 'Vacuum 관리', path: '/vacuum', icon: '🧹', keywords: ['vacuum', 'autovacuum', 'clean'] },
    { name: '쿼리 분석', path: '/query', icon: '🔍', keywords: ['query', 'slow', 'analyze', 'explain'] },
    { name: '설정', path: '/settings', icon: '⚙️', keywords: ['settings', 'config', 'alert'] },
  ];

  // 액션 명령
  const actions = [
    { 
      name: '페이지 새로고침', 
      action: () => window.location.reload(), 
      icon: '🔄', 
      keywords: ['refresh', 'reload'] 
    },
    { 
      name: 'API 상태 확인', 
      action: () => toast.info('API 연결 확인 중...'), 
      icon: '🔌', 
      keywords: ['api', 'status', 'health'] 
    },
  ];

  const handleSelect = useCallback((callback: () => void) => {
    callback();
    onClose();
  }, [onClose]);

  // Esc 키로 닫기
  useEffect(() => {
    if (isOpen) {
      const down = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };
      document.addEventListener('keydown', down);
      return () => document.removeEventListener('keydown', down);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/3 w-full max-w-2xl">
        <Command 
          className="glass-card overflow-hidden animate-slide-in"
          shouldFilter={true}
        >
          <div className="flex items-center border-b border-white/10 px-4">
            <span className="text-gray-400 text-xl mr-3">🔍</span>
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="명령어 또는 페이지 검색..."
              className="flex h-14 w-full bg-transparent text-white placeholder:text-gray-500 outline-none"
              autoFocus
            />
            <kbd className="hidden sm:inline-block px-2 py-1 text-xs text-gray-400 bg-gray-800 rounded">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-gray-400">
              결과가 없습니다.
            </Command.Empty>

            <Command.Group heading="페이지" className="text-xs text-gray-500 px-2 py-1.5">
              {pages.map((page) => (
                <Command.Item
                  key={page.path}
                  value={`${page.name} ${page.keywords.join(' ')}`}
                  onSelect={() => handleSelect(() => router.push(page.path))}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-white/10 data-[selected=true]:bg-white/10"
                >
                  <span className="text-2xl">{page.icon}</span>
                  <span className="flex-1 text-white">{page.name}</span>
                  <span className="text-xs text-gray-500">{page.path}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Separator className="h-px bg-white/10 my-2" />

            <Command.Group heading="액션" className="text-xs text-gray-500 px-2 py-1.5">
              {actions.map((action, i) => (
                <Command.Item
                  key={i}
                  value={`${action.name} ${action.keywords.join(' ')}`}
                  onSelect={() => handleSelect(action.action)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-white/10 data-[selected=true]:bg-white/10"
                >
                  <span className="text-2xl">{action.icon}</span>
                  <span className="text-white">{action.name}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Separator className="h-px bg-white/10 my-2" />

            <Command.Group heading="도움말" className="text-xs text-gray-500 px-2 py-1.5">
              <Command.Item
                value="keyboard shortcuts help"
                onSelect={() => handleSelect(() => toast.info('키보드 단축키: ? 키를 누르세요'))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-white/10 data-[selected=true]:bg-white/10"
              >
                <span className="text-2xl">⌨️</span>
                <span className="text-white">키보드 단축키</span>
                <kbd className="ml-auto px-2 py-1 text-xs bg-gray-800 rounded">?</kbd>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
