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
  const [modalUser, setModalUser] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getUsers().then((r) => {
      const data = r.data;
      if (Array.isArray(data)) return data;
      return data.users || data.data || [];
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      alert('사용자가 삭제되었습니다.');
    },
    onError: (error: any) => {
      alert(`삭제 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const handleDelete = (id: string, username: string) => {
    if (confirm(`사용자 '${username}'을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (user: any) => {
    setModalUser(user);
    setShowModal(true);
  };

  const handleCreate = () => {
    setModalUser(null);
    setShowModal(true);
  };

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
          onClick={handleCreate}
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
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEdit(user)}
                      className="text-postgres-400 hover:text-postgres-300 text-sm"
                    >
                      편집
                    </button>
                    <button 
                      onClick={() => handleDelete(user.id, user.username)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <UserModal 
          user={modalUser} 
          onClose={() => setShowModal(false)} 
        />
      )}
    </div>
  );
}

function UserModal({ user, onClose }: { user?: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    password: '',
    roleIds: user?.roles?.map((r: any) => r.roleId || r.id) || [],
  });

  // Fetch available roles
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => usersApi.getRoles().then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => user 
      ? usersApi.updateUser(user.id, data) 
      : usersApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (error: any) => {
      alert(`${user ? '수정' : '생성'} 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Prepare payload
    const payload: any = {
      username: formData.username,
      email: formData.email,
      roles: formData.roleIds, 
    };
    if (formData.password) {
      payload.password = formData.password;
    }
    mutation.mutate(payload);
  };

  const toggleRole = (roleId: string) => {
    setFormData(prev => {
      const exists = prev.roleIds.includes(roleId);
      return {
        ...prev,
        roleIds: exists 
          ? prev.roleIds.filter((id: string) => id !== roleId)
          : [...prev.roleIds, roleId]
      };
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">
          {user ? '사용자 수정' : '사용자 추가'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">사용자명</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-postgres-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">이메일</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-postgres-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              비밀번호 {user && <span className="text-gray-500 font-normal">(변경시에만 입력)</span>}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-postgres-500"
              required={!user}
              minLength={8}
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-300 mb-2">역할 할당</label>
             <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-800 p-2 rounded-lg">
               {Array.isArray(roles) && roles.map((role: any) => (
                 <label 
                   key={role.id} 
                   className={`flex items-center gap-2 text-sm cursor-pointer select-none p-2 rounded-md transition-colors ${
                     formData.roleIds.includes(role.id) 
                       ? 'bg-postgres-500/20 text-white border border-postgres-500/50' 
                       : 'text-gray-400 hover:text-white hover:bg-gray-800'
                   }`}
                 >
                   <input
                     type="checkbox"
                     checked={formData.roleIds.includes(role.id)}
                     onChange={() => toggleRole(role.id)}
                     className="rounded border-gray-700 bg-gray-800 text-postgres-500 focus:ring-postgres-500"
                   />
                   {role.name}
                 </label>
               ))}
             </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? '처리 중...' : (user ? '수정' : '생성')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RolesTab() {
  const queryClient = useQueryClient();
  const [modalRole, setModalRole] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => usersApi.getRoles().then((r) => {
      const data = r.data;
      if (Array.isArray(data)) return data;
      return data.roles || data.data || [];
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      alert('역할이 삭제되었습니다.');
    },
    onError: (error: any) => {
      alert(`삭제 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const handleDelete = (role: any) => {
    if (role.isSystem) {
      alert('시스템 역할은 삭제할 수 없습니다.');
      return;
    }
    if (confirm(`역할 '${role.name}'을(를) 삭제하시겠습니까?`)) {
      deleteMutation.mutate(role.id);
    }
  };

  const handleEdit = (role: any) => {
    setModalRole(role);
    setShowModal(true);
  };

  const handleCreate = () => {
    setModalRole(null);
    setShowModal(true);
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
        <h2 className="text-lg font-semibold text-white">역할 목록</h2>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg transition-colors"
        >
          + 역할 추가
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">이름</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">설명</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">권한 수</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">유형</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">생성일</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">작업</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role: any) => (
              <tr key={role.id} className="border-t border-gray-800">
                <td className="px-4 py-3">
                  <span className="text-white font-medium">{role.name}</span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {role.description || '-'}
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {role.permissions?.length || 0}개
                </td>
                <td className="px-4 py-3">
                  {role.isSystem ? (
                    <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded">System</span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded">Custom</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {new Date(role.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEdit(role)}
                      className="text-postgres-400 hover:text-postgres-300 text-sm"
                    >
                      편집
                    </button>
                    {!role.isSystem && (
                      <button 
                        onClick={() => handleDelete(role)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <RoleModal role={modalRole} onClose={() => setShowModal(false)} />}
    </div>
  );
}

// Enum definitions for Frontend UI
const RESOURCES = [
  'CLUSTER', 'INSTANCE', 'DATABASE', 'QUERY', 'VACUUM', 
  'SESSION', 'ALERT', 'CONFIG', 'BACKUP', 'USER', 'ROLE', 
  'AUDIT', 'CREDENTIAL'
];

const ACTIONS = ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'EXECUTE', 'APPROVE', 'ADMIN'];

function RoleModal({ role, onClose }: { role?: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: role?.name || '',
    description: role?.description || '',
    permissions: role?.permissions?.map((p: any) => ({
      resource: p.resource || p.permission?.resource,
      action: p.action || p.permission?.action,
    })) || [],
  });

  const mutation = useMutation({
    mutationFn: (data: any) => role 
      ? usersApi.updateRole(role.id, data) 
      : usersApi.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
    onError: (error: any) => {
      alert(`${role ? '수정' : '생성'} 실패: ${error.response?.data?.message || error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const togglePermission = (resource: string, action: string) => {
    setFormData(prev => {
      const exists = prev.permissions.some(
        (p: any) => p.resource === resource && p.action === action
      );
      
      let newPermissions;
      if (exists) {
        newPermissions = prev.permissions.filter(
          (p: any) => !(p.resource === resource && p.action === action)
        );
      } else {
        newPermissions = [...prev.permissions, { resource, action }];
      }
      
      return { ...prev, permissions: newPermissions };
    });
  };

  const hasPermission = (resource: string, action: string) => {
    return formData.permissions.some(
      (p: any) => p.resource === resource && p.action === action
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-4xl border border-gray-800 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">
          {role ? '역할 수정' : '역할 추가'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">역할명</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-postgres-500"
                required
                disabled={role?.isSystem} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">설명</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-postgres-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">권한 설정</label>
            <div className="border border-gray-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                    <tr>
                      <th className="px-4 py-2">Resource / Action</th>
                      {ACTIONS.map(action => (
                        <th key={action} className="px-2 py-2 text-center">{action}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {RESOURCES.map(resource => (
                      <tr key={resource} className="hover:bg-gray-800/50">
                        <td className="px-4 py-2 font-medium text-gray-300">{resource}</td>
                        {ACTIONS.map(action => (
                          <td 
                            key={`${resource}-${action}`} 
                            className={`px-2 py-2 text-center transition-colors cursor-pointer ${
                              hasPermission(resource, action) 
                                ? 'bg-postgres-500/10' 
                                : ''
                            }`}
                            onClick={() => !role?.isSystem && togglePermission(resource, action)}
                          >
                            <input
                              type="checkbox"
                              checked={hasPermission(resource, action)}
                              onChange={() => togglePermission(resource, action)}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-postgres-500 focus:ring-postgres-500 focus:ring-offset-gray-900 cursor-pointer"
                              disabled={role?.isSystem}
                              onClick={(e) => e.stopPropagation()} 
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {role?.isSystem && (
              <p className="text-xs text-yellow-500 mt-2">
                * 시스템 역할의 권한은 수정할 수 없습니다.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-postgres-600 hover:bg-postgres-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? '처리 중...' : (role ? '수정' : '생성')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const AuditTab = () => {
  const [filters, setFilters] = useState({
    action: '',
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
      CONFIG_CHANGED: 'bg-yellow-500/20 text-yellow-400',
      PERMISSION_GRANTED: 'bg-purple-500/20 text-purple-400',
      PERMISSION_REVOKED: 'bg-purple-500/20 text-purple-400',
      QUERY_EXECUTED: 'bg-orange-500/20 text-orange-400',
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
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          >
            <option value="">전체</option>
            <option value="LOGIN">로그인</option>
            <option value="LOGIN_FAILED">로그인 실패</option>
            <option value="LOGOUT">로그아웃</option>
            <option value="QUERY_EXECUTED">쿼리 실행</option>
            <option value="CONFIG_CHANGED">설정 변경</option>
            <option value="PERMISSION_GRANTED">권한 부여</option>
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
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">상세</th>
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
                    <span className={`px-2 py-1 text-xs rounded ${getEventTypeBadge(event.action)}`}>
                      {event.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {event.resource ? `${event.resource}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm max-w-xs truncate" title={JSON.stringify(event.metadata || {})}>
                    {event.metadata ? JSON.stringify(event.metadata) : '-'}
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
