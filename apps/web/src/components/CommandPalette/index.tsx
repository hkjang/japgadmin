'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { toast } from 'sonner';
import { CommandInput } from './CommandInput';
import { PageGroup } from './PageGroup';
import { ActionGroup } from './ActionGroup';
import { HelpGroup } from './HelpGroup';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const pages = [
    { name: '대시보드', path: '/', icon: '📊', keywords: ['dashboard', 'home'] },
    { name: '모니터링', path: '/monitoring', icon: '📈', keywords: ['monitor', 'activity', 'lock'] },
    { name: 'Vacuum 관리', path: '/vacuum', icon: '🧹', keywords: ['vacuum', 'autovacuum', 'clean'] },
    { name: '쿼리 분석', path: '/query', icon: '🔍', keywords: ['query', 'slow', 'analyze', 'explain'] },
    { name: '설정', path: '/settings', icon: '⚙️', keywords: ['settings', 'config', 'alert'] },
  ];

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
        <Command className="glass-card overflow-hidden animate-slide-in" shouldFilter={true}>
          <CommandInput value={search} onValueChange={setSearch} />

          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-gray-400">
              결과가 없습니다.
            </Command.Empty>

            <PageGroup pages={pages} onSelect={handleSelect} onNavigate={router.push} />
            <Command.Separator className="h-px bg-white/10 my-2" />
            
            <ActionGroup actions={actions} onSelect={handleSelect} />
            <Command.Separator className="h-px bg-white/10 my-2" />
            
            <HelpGroup onSelect={handleSelect} />
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
