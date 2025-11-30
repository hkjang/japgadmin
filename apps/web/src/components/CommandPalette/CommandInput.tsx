'use client';

import { Command } from 'cmdk';

interface CommandInputProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function CommandInput({ value, onValueChange }: CommandInputProps) {
  return (
    <div className="flex items-center border-b border-white/10 px-4">
      <span className="text-gray-400 text-xl mr-3">🔍</span>
      <Command.Input
        value={value}
        onValueChange={onValueChange}
        placeholder="명령어 또는 페이지 검색..."
        className="flex h-14 w-full bg-transparent text-white placeholder:text-gray-500 outline-none"
        autoFocus
      />
      <kbd className="hidden sm:inline-block px-2 py-1 text-xs text-gray-400 bg-gray-800 rounded">
        ESC
      </kbd>
    </div>
  );
}
