'use client';

import React from 'react';
import Editor from 'react-simple-code-editor';
// @ts-ignore
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-sql';
import 'prismjs/themes/prism-tomorrow.css'; // Dark theme

interface SqlEditorProps {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  placeholder?: string;
}

export function SqlEditor({ value, onChange, className, placeholder }: SqlEditorProps) {
  return (
    <div className={`rounded-lg overflow-hidden border border-gray-700 bg-gray-900 ${className}`}>
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={(code) => highlight(code, languages.sql, 'sql')}
        padding={10}
        placeholder={placeholder}
        style={{
          fontFamily: '"Fira code", "Fira Mono", monospace',
          fontSize: 14,
          minHeight: '200px', // Default min height
          color: '#f8f8f2',
          backgroundColor: '#111827', // dark-900 matches
        }}
        textareaClassName="focus:outline-none"
      />
    </div>
  );
}
