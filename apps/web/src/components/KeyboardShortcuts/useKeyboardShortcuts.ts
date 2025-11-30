'use client';

import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function useKeyboardShortcuts() {
  const router = useRouter();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [gPressed, setGPressed] = useState(false);

  // G 키 시퀀스
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
