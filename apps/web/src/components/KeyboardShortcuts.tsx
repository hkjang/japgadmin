'use client';

import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface KeyboardShortcut {
  key: string;
  description: string;
  category: string;
}

const shortcuts: KeyboardShortcut[] = [
  { key: 'Cmd/Ctrl + K', description: 'Command Palette 열기', category: '전역' },
  { key: '?', description: '키보드 단축키 도움말', category: '전역' },
  { key: 'G → D', description: '대시보드로 이동', category: '네비게이션' },
  { key: 'G → M', description: '모니터링으로 이동', category: '네비게이션' },
  { key: 'G → V', description: 'Vacuum으로 이동', category: '네비게이션' },
  { key: 'G → Q', description: '쿼리 분석으로 이동', category: '네비게이션' },
  { key: 'G → S', description: '설정으로 이동', category: '네비게이션' },
  { key: 'R', description: '현재 페이지 새로고침', category: '액션' },
];

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>⌨️</span>
              <span>키보드 단축키</span>
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>

          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-gray-400 mb-3">{category}</h3>
                <div className="space-y-2">
                  {shortcuts
                    .filter((s) => s.category === category)
                    .map((shortcut, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <span className="text-white">{shortcut.description}</span>
                        <kbd className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded border border-gray-700">
                          {shortcut.key}
                        </kbd>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-sm text-gray-400 text-center">
              <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">ESC</kbd> 또는 바깥 클릭으로 닫기
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useKeyboardShortcuts() {
  const router = useRouter();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [gPressed, setGPressed] = useState(false);

  // G 키 시퀀스 타임아웃
  useHotkeys('g', () => {
    setGPressed(true);
    setTimeout(() => setGPressed(false), 1000);
  }, { preventDefault: true });

  // G → D: 대시보드
  useHotkeys('d', () => {
    if (gPressed) {
      router.push('/');
      toast.success('대시보드로 이동');
      setGPressed(false);
    }
  }, [gPressed], { enabled: gPressed });

  // G → M: 모니터링
  useHotkeys('m', () => {
    if (gPressed) {
      router.push('/monitoring');
      toast.success('모니터링으로 이동');
      setGPressed(false);
    }
  }, [gPressed], { enabled: gPressed });

  // G → V: Vacuum
  useHotkeys('v', () => {
    if (gPressed) {
      router.push('/vacuum');
      toast.success('Vacuum으로 이동');
      setGPressed(false);
    }
  }, [gPressed], { enabled: gPressed });

  // G → Q: 쿼리
  useHotkeys('q', () => {
    if (gPressed) {
      router.push('/query');
      toast.success('쿼리 분석으로 이동');
      setGPressed(false);
    }
  }, [gPressed], { enabled: gPressed });

  // G → S: 설정
  useHotkeys('s', () => {
    if (gPressed) {
      router.push('/settings');
      toast.success('설정으로 이동');
      setGPressed(false);
    }
  }, [gPressed], { enabled: gPressed });

  // R: 새로고침
  useHotkeys('r', () => {
    window.location.reload();
  }, { preventDefault: true });

  // ?: 도움말
  useHotkeys('shift+/', () => {
    setIsHelpOpen(true);
  }, { preventDefault: true });

  return {
    isHelpOpen,
    setIsHelpOpen,
  };
}
