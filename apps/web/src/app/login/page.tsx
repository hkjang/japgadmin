'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(username, password);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || '로그인에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-postgres-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-postgres-400 to-postgres-600 bg-clip-text text-transparent">
            PostgreSQL
          </h1>
          <p className="text-gray-400 mt-2">관리 도구</p>
        </div>

        {/* Login Form */}
        <div className="glass-card p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">로그인</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
                사용자명
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-postgres-500 focus:border-transparent"
                placeholder="사용자명 입력"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-postgres-500 focus:border-transparent"
                placeholder="비밀번호 입력"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-postgres-600 hover:bg-postgres-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  로그인 중...
                </span>
              ) : (
                '로그인'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>기본 관리자 계정: admin@example.com / adminpassword</p>
            
            {process.env.NODE_ENV === 'development' && (
              <button
                type="button"
                onClick={async () => {
                   setError('');
                   setIsSubmitting(true);
                   try {
                     await login('admin', 'adminpassword');
                     router.push('/');
                   } catch (err: any) {
                     setError(err.response?.data?.message || '로그인에 실패했습니다');
                   } finally {
                     setIsSubmitting(false);
                   }
                }}
                disabled={isSubmitting}
                className="mt-4 w-full py-2 px-4 bg-gray-900/50 hover:bg-gray-800 text-gray-400 text-xs font-medium rounded-lg transition-colors border border-gray-800 border-dashed"
              >
                ⚡ 개발자 자동 로그인 (Admin)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
