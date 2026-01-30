'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, auditApi } from '@/lib/api';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'audit'>('users');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">관리자</h1>
        <p className="text-gray-400 mt-1">사용자, 역할 및 감사 로그 관리</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'users'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          사용자
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'roles'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          역할
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'audit'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          감사 로그
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'roles' && <RolesTab />}
      {activeTab === 'audit' && <AuditTab />}
    </div>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getUsers().then((r) => r.data),
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-green-500/20 text-green-400',
      INACTIVE: 'bg-gray-500/20 text-gray-400',
      SUSPENDED: 'bg-red-500/20 text-red-400',
    };
    return styles[status] || styles.INACTIVE;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-postgres-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">사용자 목록</h2>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg transition-colors"
        >
          + 사용자 추가
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">사용자명</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">이메일</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">역할</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">상태</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">마지막 로그인</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">작업</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user: any) => (
              <tr key={user.id} className="border-t border-gray-800">
                <td className="px-4 py-3">
                  <span className="text-white font-medium">{user.username}</span>
                </td>
                <td className="px-4 py-3 text-gray-400">{user.email}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {user.roles?.map((role: any) => (
                      <span
                        key={role.id}
                        className="px-2 py-1 text-xs bg-postgres-500/20 text-postgres-400 rounded"
                      >
                        {role.role?.name || role.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded ${getStatusBadge(user.status)}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString('ko-KR')
                    : '-'}
                </td>
                <td className="px-4 py-3">
                  <button className="text-gray-400 hover:text-white text-sm">편집</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <UserModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

function UserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => usersApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (error: any) => {
      alert(`생성 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">사용자 추가</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">사용자명</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">이메일</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">비밀번호</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
              minLength={8}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg disabled:opacity-50"
            >
              {createMutation.isPending ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RolesTab() {
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => usersApi.getRoles().then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-postgres-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">역할 목록</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role: any) => (
          <div key={role.id} className="glass-card p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-white font-medium">{role.name}</h3>
                <p className="text-sm text-gray-400">{role.description}</p>
              </div>
              {role.isSystem && (
                <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded">
                  시스템
                </span>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">권한:</p>
              <div className="flex flex-wrap gap-1">
                {role.permissions?.slice(0, 5).map((perm: any) => (
                  <span
                    key={perm.id}
                    className="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded"
                  >
                    {perm.permission?.resource}:{perm.permission?.action}
                  </span>
                ))}
                {role.permissions?.length > 5 && (
                  <span className="px-2 py-1 text-xs text-gray-500">
                    +{role.permissions.length - 5}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditTab() {
  const [filters, setFilters] = useState({
    eventType: '',
    startDate: '',
    endDate: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs', filters],
    queryFn: () => auditApi.getLogs(filters).then((r) => r.data),
  });

  const events = data?.events || [];

  const getEventTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      LOGIN: 'bg-green-500/20 text-green-400',
      LOGIN_FAILED: 'bg-red-500/20 text-red-400',
      LOGOUT: 'bg-gray-500/20 text-gray-400',
      RESOURCE_ACCESS: 'bg-blue-500/20 text-blue-400',
      CONFIG_CHANGE: 'bg-yellow-500/20 text-yellow-400',
      PERMISSION_CHANGE: 'bg-purple-500/20 text-purple-400',
      DATA_EXPORT: 'bg-orange-500/20 text-orange-400',
    };
    return styles[type] || 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">이벤트 유형</label>
          <select
            value={filters.eventType}
            onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          >
            <option value="">전체</option>
            <option value="LOGIN">로그인</option>
            <option value="LOGIN_FAILED">로그인 실패</option>
            <option value="LOGOUT">로그아웃</option>
            <option value="RESOURCE_ACCESS">리소스 접근</option>
            <option value="CONFIG_CHANGE">설정 변경</option>
            <option value="PERMISSION_CHANGE">권한 변경</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">시작일</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">종료일</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-postgres-500"></div>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">시간</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">사용자</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">이벤트</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">리소스</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">IP 주소</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event: any) => (
                <tr key={event.id} className="border-t border-gray-800">
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(event.timestamp).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-white">
                    {event.user?.username || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded ${getEventTypeBadge(event.eventType)}`}>
                      {event.eventType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {event.resourceType ? `${event.resourceType}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {event.ipAddress || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
