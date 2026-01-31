'use client';

import React from 'react';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

SyntaxHighlighter.registerLanguage('sql', sql);

interface SqlDisplayProps {
  code: string;
  className?: string;
  maxHeight?: string;
}

export function SqlDisplay({ code, className, maxHeight }: SqlDisplayProps) {
  return (
    <div className={`rounded-md overflow-hidden ${className}`}>
      <SyntaxHighlighter
        language="sql"
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '1rem',
          backgroundColor: '#111827', // bg-gray-900
          fontSize: '0.875rem', // text-sm
          maxHeight: maxHeight || 'none',
        }}
        wrapLines={true}
        wrapLongLines={true}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
