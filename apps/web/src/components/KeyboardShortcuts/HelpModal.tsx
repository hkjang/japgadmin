'use client';

import { ShortcutItem } from './ShortcutItem';

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
                      <ShortcutItem key={i} shortcut={shortcut} />
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
