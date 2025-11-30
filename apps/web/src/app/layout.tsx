'use client';

import '@/styles/globals.css';
import '../lib/i18n';
import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';
import { queryClient } from '@/lib/query-client';
import Sidebar from '@/components/Layout/Sidebar';
import CommandPalette from '@/components/CommandPalette';
import { KeyboardShortcutsHelp, useKeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const { isHelpOpen, setIsHelpOpen } = useKeyboardShortcuts();

  // Cmd/Ctrl + K: Command Palette
  useHotkeys('mod+k', (e) => {
    e.preventDefault();
    setIsCommandOpen(true);
  });

  return (
    <html lang="ko">
      <body className={`${inter.className} custom-scrollbar`}>
        <QueryClientProvider client={queryClient}>
          <div className="flex min-h-screen">
            {/* Sidebar */}
            <Sidebar onCommandOpen={() => setIsCommandOpen(true)} />

            {/* Main Content */}
            <main className="flex-1 animate-fade-in">
              {children}
            </main>
          </div>

          {/* Command Palette */}
          <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />

          {/* Keyboard Shortcuts Help */}
          <KeyboardShortcutsHelp isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

          {/* Toast Notifications */}
          <Toaster 
            position="top-right"
            expand={true}
            richColors
            closeButton
          />

          {/* React Query Devtools */}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </body>
    </html>
  );
}
