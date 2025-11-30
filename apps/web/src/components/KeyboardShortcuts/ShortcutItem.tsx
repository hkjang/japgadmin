'use client';

interface ShortcutItemProps {
  shortcut: {
    key: string;
    description: string;
  };
}

export function ShortcutItem({ shortcut }: ShortcutItemProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
      <span className="text-white">{shortcut.description}</span>
      <kbd className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded border border-gray-700">
        {shortcut.key}
      </kbd>
    </div>
  );
}
