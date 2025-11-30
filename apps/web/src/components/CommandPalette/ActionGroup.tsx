'use client';

import { Command } from 'cmdk';

interface ActionItem {
  name: string;
  action: () => void;
  icon: string;
  keywords: string[];
}

interface ActionGroupProps {
  actions: ActionItem[];
  onSelect: (callback: () => void) => void;
}

export function ActionGroup({ actions, onSelect }: ActionGroupProps) {
  return (
    <Command.Group heading="액션" className="text-xs text-gray-500 px-2 py-1.5">
      {actions.map((action, i) => (
        <Command.Item
          key={i}
          value={`${action.name} ${action.keywords.join(' ')}`}
          onSelect={() => onSelect(action.action)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-white/10 data-[selected=true]:bg-white/10"
        >
          <span className="text-2xl">{action.icon}</span>
          <span className="text-white">{action.name}</span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}
