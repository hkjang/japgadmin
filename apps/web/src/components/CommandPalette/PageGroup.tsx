'use client';

import { Command } from 'cmdk';

interface PageItem {
  name: string;
  path: string;
  icon: string;
  keywords: string[];
}

interface PageGroupProps {
  pages: PageItem[];
  onSelect: (callback: () => void) => void;
  onNavigate: (path: string) => void;
}

export function PageGroup({ pages, onSelect, onNavigate }: PageGroupProps) {
  return (
    <Command.Group heading="페이지" className="text-xs text-gray-500 px-2 py-1.5">
      {pages.map((page) => (
        <Command.Item
          key={page.path}
          value={`${page.name} ${page.keywords.join(' ')}`}
          onSelect={() => onSelect(() => onNavigate(page.path))}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-white/10 data-[selected=true]:bg-white/10"
        >
          <span className="text-2xl">{page.icon}</span>
          <span className="flex-1 text-white">{page.name}</span>
          <span className="text-xs text-gray-500">{page.path}</span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}
