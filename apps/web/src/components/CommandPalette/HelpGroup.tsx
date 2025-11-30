'use client';

import { Command } from 'cmdk';
import { toast } from 'sonner';

interface HelpGroupProps {
  onSelect: (callback: () => void) => void;
}

export function HelpGroup({ onSelect }: HelpGroupProps) {
  return (
    <Command.Group heading="도움말" className="text-xs text-gray-500 px-2 py-1.5">
      <Command.Item
        value="keyboard shortcuts help"
        onSelect={() => onSelect(() => toast.info('키보드 단축키: ? 키를 누르세요'))}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-white/10 data-[selected=true]:bg-white/10"
      >
        <span className="text-2xl">⌨️</span>
        <span className="text-white">키보드 단축키</span>
        <kbd className="ml-auto px-2 py-1 text-xs bg-gray-800 rounded">?</kbd>
      </Command.Item>
    </Command.Group>
  );
}
