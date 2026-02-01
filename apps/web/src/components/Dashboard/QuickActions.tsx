'use client';

import Link from 'next/link';

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: string;
  color: string;
}

export default function QuickActions() {
  const actions: QuickAction[] = [
    {
      label: '쿼리 콘솔',
      description: 'SQL 쿼리 실행',
      href: '/query-console',
      icon: '⌨️',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'VACUUM 실행',
      description: '테이블 정리',
      href: '/vacuum',
      icon: '🧹',
      color: 'from-emerald-500 to-green-500',
    },
    {
      label: '느린 쿼리',
      description: '성능 분석',
      href: '/query',
      icon: '🐌',
      color: 'from-orange-500 to-yellow-500',
    },
    {
      label: '세션 관리',
      description: '활성 연결',
      href: '/monitoring',
      icon: '👥',
      color: 'from-purple-500 to-pink-500',
    },
  ];

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-white mb-4">빠른 작업</h3>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => (
          <Link
            key={index}
            href={action.href}
            className="group p-4 rounded-lg bg-dark-700/50 hover:bg-dark-600/50 border border-dark-600 hover:border-dark-500 transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className={`text-2xl transform group-hover:scale-110 transition-transform`}>
                {action.icon}
              </div>
              <div>
                <div className={`text-sm font-medium bg-gradient-to-r ${action.color} bg-clip-text text-transparent`}>
                  {action.label}
                </div>
                <div className="text-xs text-gray-500">{action.description}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
