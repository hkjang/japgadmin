'use client';

import { useEffect, useRef } from 'react';

interface MiniSparklineProps {
  data: number[];
  color: string;
  height?: number;
}

export default function MiniSparkline({ data, color, height = 30 }: MiniSparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 고해상도 지원
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // 캔버스 초기화
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 데이터 정규화
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    // 포인트 계산
    const points: { x: number; y: number }[] = data.map((value, index) => ({
      x: (index / (data.length - 1)) * rect.width,
      y: rect.height - ((value - min) / range) * (rect.height - 4) - 2,
    }));

    // 그라데이션 배경
    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, color + '00');

    // 영역 채우기
    ctx.beginPath();
    ctx.moveTo(points[0].x, rect.height);
    points.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.lineTo(points[points.length - 1].x, rect.height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 라인 그리기
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const xc = (points[i].x + points[i - 1].x) / 2;
      const yc = (points[i].y + points[i - 1].y) / 2;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 마지막 점
    const lastPoint = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, [data, color, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height }}
      className="opacity-80"
    />
  );
}
