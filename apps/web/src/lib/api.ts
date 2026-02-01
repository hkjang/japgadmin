import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token refresh state
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401 에러이고, 재시도하지 않은 요청이면 토큰 갱신 시도
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 로그인 요청이면 재시도 안함
      if (originalRequest.url?.includes('/auth/login')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // 이미 갱신 중이면 큐에 추가
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        localStorage.setItem('auth_token', accessToken);
        if (newRefreshToken) {
          localStorage.setItem('refresh_token', newRefreshToken);
        }

        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);

        // 토큰 갱신 실패 시 로그아웃 처리
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        delete api.defaults.headers.common.Authorization;

        // 로그인 페이지로 리다이렉트 (옵션)
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export interface Activity {
  pid: number;
  usename: string;
  application_name: string;
  state: string;
  query: string;
  duration_ms: number;
}

export interface DatabaseStats {
  database: string;
  stats: {
    active_connections: number;
    committed_transactions: number;
    rolled_back_transactions: number;
    cache_hit_ratio: number;
    deadlocks: number;
    blks_read: number;
    blks_hit: number;
  };

}

export interface VacuumHistoryItem {
  id: number;
  targetDb: string;
  tableName: string;
  vacuumType: string;
  duration: number;
  status: 'success' | 'failed';
  errorMessage?: string;
  timestamp: string;
}

export interface AutovacuumStat {
  schemaname: string;
  table_name: string;
  dead_tuples: number;
  live_tuples: number;
  dead_tuple_percentage: string;
  last_autovacuum: string | null;
}

export interface VacuumGlobalSetting {
  name: string;
  setting: string;
  unit: string;
  short_desc: string;
  min_val: string;
  max_val: string;
}

export const monitoringApi = {
  getActivity: () => api.get(`${API_BASE_URL}/monitoring/activity`),
  getDatabaseStats: () => api.get(`${API_BASE_URL}/monitoring/database`),
  getWaitEvents: () => api.get(`${API_BASE_URL}/monitoring/wait-events`),
  getTableSizes: () => api.get(`${API_BASE_URL}/monitoring/table-sizes`),
  getBgwriterStats: () => api.get(`${API_BASE_URL}/monitoring/bgwriter`),
  getConnectionStats: () => api.get(`${API_BASE_URL}/monitoring/connection-stats`),
  getTxidWraparound: () => api.get(`${API_BASE_URL}/monitoring/txid-wraparound`),
  getLocks: () => api.get(`${API_BASE_URL}/monitoring/locks`),
  getPerformanceHistory: () => api.get(`${API_BASE_URL}/monitoring/performance-history`),
  getDiskUsage: () => api.get(`${API_BASE_URL}/monitoring/disk-usage`),
  getReplicationStatus: () => api.get(`${API_BASE_URL}/monitoring/replication-status`),
  getDatabases: () => api.get(`${API_BASE_URL}/monitoring/databases`),
  getDatabaseTableSizes: (database?: string) => {
    const query = database ? `?database=${database}` : '';
    return api.get(`${API_BASE_URL}/monitoring/database-table-sizes${query}`);
  },
};

export const vacuumApi = {
  execute: (tableName: string, vacuumType: 'VACUUM' | 'VACUUM FULL' | 'ANALYZE') => 
    api.post(`${API_BASE_URL}/vacuum/execute`, { tableName, vacuumType }),
  getHistory: () => api.get(`${API_BASE_URL}/vacuum/history`),
  getAutovacuumStats: () => api.get(`${API_BASE_URL}/vacuum/autovacuum`),
  getTableStats: () => api.get(`${API_BASE_URL}/vacuum/table-stats`),
  getGlobalSettings: () => api.get(`${API_BASE_URL}/vacuum/settings/global`),
  getTableSettings: (tableName: string) => api.get(`${API_BASE_URL}/vacuum/settings/table?tableName=${tableName}`),
  updateTableSettings: (tableName: string, settings: Record<string, string | null>) => 
    api.post(`${API_BASE_URL}/vacuum/settings/table`, { tableName, settings }),
};

export const queryApi = {
  getSlowQueries: () => api.get(`${API_BASE_URL}/query/slow`),
  explain: (query: string) => api.post(`${API_BASE_URL}/query/explain`, { query }),
  getHistory: () => api.get(`${API_BASE_URL}/query/history`),
  getStats: () => api.get(`${API_BASE_URL}/query/stats`),
};

export const alertApi = {
  getConfigs: () => api.get(`${API_BASE_URL}/alert/configs`),
  createConfig: (data: any) => api.post(`${API_BASE_URL}/alert/configs`, data),
  updateConfig: (id: string, data: any) => api.put(`${API_BASE_URL}/alert/configs/${id}`, data),
  deleteConfig: (id: string) => api.delete(`${API_BASE_URL}/alert/configs/${id}`),
  getHistory: () => api.get(`${API_BASE_URL}/alert/history`),
  test: (id: string) => api.post(`${API_BASE_URL}/alert/test`, { id }),
};

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    api.post(`${API_BASE_URL}/auth/login`, { email: username, password }),
  logout: () => api.post(`${API_BASE_URL}/auth/logout`),
  getProfile: () => api.get(`${API_BASE_URL}/auth/profile`),
  register: (data: { username: string; email: string; password: string }) =>
    api.post(`${API_BASE_URL}/auth/register`, data),
};

// Inventory API
export const inventoryApi = {
  // Clusters
  getClusters: () => api.get(`${API_BASE_URL}/clusters`),
  getCluster: (id: string) => api.get(`${API_BASE_URL}/clusters/${id}`),
  createCluster: (data: any) => api.post(`${API_BASE_URL}/clusters`, data),
  updateCluster: (id: string, data: any) => api.put(`${API_BASE_URL}/clusters/${id}`, data),
  deleteCluster: (id: string) => api.delete(`${API_BASE_URL}/clusters/${id}`),

  // Instances
  getInstances: (clusterId?: string) => {
    const query = clusterId ? `?clusterId=${clusterId}` : '';
    return api.get(`${API_BASE_URL}/instances${query}`);
  },
  getInstance: (id: string) => api.get(`${API_BASE_URL}/instances/${id}`),
  createInstance: (data: any) => api.post(`${API_BASE_URL}/instances`, data),
  updateInstance: (id: string, data: any) => api.put(`${API_BASE_URL}/instances/${id}`, data),
  deleteInstance: (id: string) => api.delete(`${API_BASE_URL}/instances/${id}`),
  testConnection: (id: string) => api.post(`${API_BASE_URL}/instances/${id}/test-connection`),

  // Databases
  getDatabases: (instanceId: string) => api.get(`${API_BASE_URL}/instances/${instanceId}/databases`),
  discoverDatabases: (instanceId: string) =>
    api.post(`${API_BASE_URL}/instances/${instanceId}/databases/discover`),
};

// Session API
export const sessionApi = {
  getSessions: (instanceId: string) => api.get(`${API_BASE_URL}/instances/${instanceId}/sessions`),
  cancelQuery: (instanceId: string, pid: number) =>
    api.post(`${API_BASE_URL}/instances/${instanceId}/sessions/${pid}/cancel`),
  terminateSession: (instanceId: string, pid: number) =>
    api.post(`${API_BASE_URL}/instances/${instanceId}/sessions/${pid}/terminate`),
  getBlockingInfo: (instanceId: string) =>
    api.get(`${API_BASE_URL}/instances/${instanceId}/sessions/blocking`),
};

// Lock API
export const lockApi = {
  getLocks: (instanceId: string) => api.get(`${API_BASE_URL}/instances/${instanceId}/locks`),
  getBlockingTree: (instanceId: string) =>
    api.get(`${API_BASE_URL}/instances/${instanceId}/locks/blocking-tree`),
  detectDeadlocks: (instanceId: string) =>
    api.get(`${API_BASE_URL}/instances/${instanceId}/locks/deadlocks`),
};

// Schema Browser API
export const schemaApi = {
  getSchemas: (instanceId: string) => api.get(`${API_BASE_URL}/instances/${instanceId}/schema/schemas`),
  getTables: (instanceId: string, schema?: string) => {
    const query = schema ? `?schema=${schema}` : '';
    return api.get(`${API_BASE_URL}/instances/${instanceId}/schema/tables${query}`);
  },
  getTableColumns: (instanceId: string, schema: string, table: string) =>
    api.get(`${API_BASE_URL}/instances/${instanceId}/schema/tables/${schema}/${table}/columns`),
  getIndexes: (instanceId: string, schema: string, table: string) =>
    api.get(`${API_BASE_URL}/instances/${instanceId}/schema/tables/${schema}/${table}/indexes`),
  getDDL: (instanceId: string, schema: string, table: string) =>
    api.get(`${API_BASE_URL}/instances/${instanceId}/schema/tables/${schema}/${table}/ddl`),
  searchObjects: (instanceId: string, query: string) =>
    api.get(`${API_BASE_URL}/instances/${instanceId}/schema/search?query=${query}`),
  createTable: (instanceId: string, data: { schema: string; name: string; columns: any[] }) =>
    api.post(`${API_BASE_URL}/instances/${instanceId}/schema/tables`, data),
  dropTable: (instanceId: string, schema: string, table: string) =>
    api.delete(`${API_BASE_URL}/instances/${instanceId}/schema/tables/${schema}/${table}`),
  addColumn: (instanceId: string, schema: string, table: string, column: any) =>
    api.post(`${API_BASE_URL}/instances/${instanceId}/schema/tables/${schema}/${table}/columns`, column),
  dropColumn: (instanceId: string, schema: string, table: string, column: string) =>
    api.delete(`${API_BASE_URL}/instances/${instanceId}/schema/tables/${schema}/${table}/columns/${column}`),
  alterColumn: (instanceId: string, schema: string, table: string, column: string, changes: any) =>
    api.put(`${API_BASE_URL}/instances/${instanceId}/schema/tables/${schema}/${table}/columns/${column}`, changes),
  createIndex: (instanceId: string, data: { schema: string; tableName: string; indexName: string; columns: string[]; isUnique: boolean }) =>
    api.post(`${API_BASE_URL}/instances/${instanceId}/schema/indexes`, data),
  dropIndex: (instanceId: string, schema: string, indexName: string) =>
    api.delete(`${API_BASE_URL}/instances/${instanceId}/schema/indexes/${schema}/${indexName}`),
};

// Users & Roles API
export const usersApi = {
  getUsers: () => api.get(`${API_BASE_URL}/users`),
  getUser: (id: string) => api.get(`${API_BASE_URL}/users/${id}`),
  createUser: (data: any) => api.post(`${API_BASE_URL}/users`, data),
  updateUser: (id: string, data: any) => api.put(`${API_BASE_URL}/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`${API_BASE_URL}/users/${id}`),
  getRoles: () => api.get(`${API_BASE_URL}/roles`),
  createRole: (data: any) => api.post(`${API_BASE_URL}/roles`, data),
  updateRole: (id: string, data: any) => api.put(`${API_BASE_URL}/roles/${id}`, data),
  deleteRole: (id: string) => api.delete(`${API_BASE_URL}/roles/${id}`),
  assignRole: (userId: string, roleId: string, scope?: any) =>
    api.post(`${API_BASE_URL}/users/${userId}/roles`, { roleId, scope }),
  removeRole: (userId: string, roleId: string) =>
    api.delete(`${API_BASE_URL}/users/${userId}/roles/${roleId}`),
};

// Backup API
export const backupApi = {
  getConfigs: (instanceId?: string) => {
    const query = instanceId ? `?instanceId=${instanceId}` : '';
    return api.get(`${API_BASE_URL}/backups/configs${query}`);
  },
  createConfig: (data: any) => api.post(`${API_BASE_URL}/backups/configs`, data),
  updateConfig: (id: string, data: any) => api.put(`${API_BASE_URL}/backups/configs/${id}`, data),
  deleteConfig: (id: string) => api.delete(`${API_BASE_URL}/backups/configs/${id}`),
  getBackups: (filters?: any) => {
    const params = new URLSearchParams(filters).toString();
    return api.get(`${API_BASE_URL}/backups?${params}`);
  },
  createBackup: (data: any) => api.post(`${API_BASE_URL}/backups`, data),
  deleteBackup: (id: string) => api.delete(`${API_BASE_URL}/backups/${id}`),
  getStatistics: (instanceId?: string) => {
    const query = instanceId ? `?instanceId=${instanceId}` : '';
    return api.get(`${API_BASE_URL}/backups/statistics${query}`);
  },
  getPitrRange: (instanceId: string) =>
    api.get(`${API_BASE_URL}/backups/pitr/${instanceId}/range`),
  restoreBackup: (id: string) => api.post(`${API_BASE_URL}/backups/${id}/restore`),
  downloadBackup: (id: string) =>
    api.get(`${API_BASE_URL}/backups/${id}/download`, {
      responseType: 'blob',
    }),
};

// Replication API
export const replicationApi = {
  getStatus: (instanceId: string) =>
    api.get(`${API_BASE_URL}/replication/instances/${instanceId}/status`),
  getStandbys: (instanceId: string) =>
    api.get(`${API_BASE_URL}/replication/instances/${instanceId}/standbys`),
  getSlots: (instanceId: string) =>
    api.get(`${API_BASE_URL}/replication/instances/${instanceId}/slots`),
  getHealth: (instanceId: string) =>
    api.get(`${API_BASE_URL}/replication/instances/${instanceId}/health`),
  getClusterTopology: (clusterId: string) =>
    api.get(`${API_BASE_URL}/replication/clusters/${clusterId}/topology`),
  createSlot: (instanceId: string, slotName: string, isLogical?: boolean) =>
    api.post(`${API_BASE_URL}/replication/instances/${instanceId}/slots`, { slotName, isLogical }),
  dropSlot: (instanceId: string, slotName: string) =>
    api.delete(`${API_BASE_URL}/replication/instances/${instanceId}/slots/${slotName}`),
  pauseWalReplay: (instanceId: string) =>
    api.post(`${API_BASE_URL}/replication/instances/${instanceId}/wal/pause`),
  resumeWalReplay: (instanceId: string) =>
    api.post(`${API_BASE_URL}/replication/instances/${instanceId}/wal/resume`),
  switchWal: (instanceId: string) =>
    api.post(`${API_BASE_URL}/replication/instances/${instanceId}/wal/switch`),
};

// Failover API
export const failoverApi = {
  checkReadiness: (clusterId: string) =>
    api.get(`${API_BASE_URL}/failover/clusters/${clusterId}/readiness`),
  initiateFailover: (data: any) => api.post(`${API_BASE_URL}/failover`, data),
  initiateSwitchover: (clusterId: string, newPrimaryId: string) =>
    api.post(`${API_BASE_URL}/failover/switchover`, { clusterId, newPrimaryId }),
  getHistory: (filters?: any) => {
    const params = new URLSearchParams(filters).toString();
    return api.get(`${API_BASE_URL}/failover/history?${params}`);
  },
  getConfig: (clusterId: string) =>
    api.get(`${API_BASE_URL}/failover/clusters/${clusterId}/config`),
  updateConfig: (clusterId: string, data: any) =>
    api.put(`${API_BASE_URL}/failover/clusters/${clusterId}/config`, data),
};

// Audit API
export const auditApi = {
  getLogs: (filters?: any) => {
    const params = new URLSearchParams(filters).toString();
    return api.get(`${API_BASE_URL}/audit/logs?${params}`);
  },
  getLog: (id: string) => api.get(`${API_BASE_URL}/audit/logs/${id}`),
  getUserActivity: (userId: string, days?: number) => {
    const query = days ? `?days=${days}` : '';
    return api.get(`${API_BASE_URL}/audit/users/${userId}/activity${query}`);
  },
  getStatistics: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return api.get(`${API_BASE_URL}/audit/statistics?${params}`);
  },
  getSecurityAnomalies: () => api.get(`${API_BASE_URL}/audit/security/anomalies`),
  getComplianceReport: (startDate: string, endDate: string) =>
    api.get(`${API_BASE_URL}/audit/compliance/report?startDate=${startDate}&endDate=${endDate}`),
};

// Task API
export const taskApi = {
  getTasks: (filters?: any) => {
    const params = new URLSearchParams(filters).toString();
    return api.get(`${API_BASE_URL}/tasks?${params}`);
  },
  getTask: (id: string) => api.get(`${API_BASE_URL}/tasks/${id}`),
  createTask: (data: any) => api.post(`${API_BASE_URL}/tasks`, data),
  cancelTask: (id: string) => api.post(`${API_BASE_URL}/tasks/${id}/cancel`),
  retryTask: (id: string) => api.post(`${API_BASE_URL}/tasks/${id}/retry`),
  getQueueStats: () => api.get(`${API_BASE_URL}/tasks/stats`),
  getActiveJobs: () => api.get(`${API_BASE_URL}/tasks/active`),
  getFailedJobs: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return api.get(`${API_BASE_URL}/tasks/failed${query}`);
  },
  // Schedules
  getSchedules: (instanceId?: string) => {
    const query = instanceId ? `?instanceId=${instanceId}` : '';
    return api.get(`${API_BASE_URL}/tasks/schedules${query}`);
  },
  createSchedule: (data: any) => api.post(`${API_BASE_URL}/tasks/schedules`, data),
  updateSchedule: (id: string, data: any) => api.put(`${API_BASE_URL}/tasks/schedules/${id}`, data),
  deleteSchedule: (id: string) => api.delete(`${API_BASE_URL}/tasks/schedules/${id}`),
  toggleSchedule: (id: string) => api.post(`${API_BASE_URL}/tasks/schedules/${id}/toggle`),
};

// Query Console API
export const queryConsoleApi = {
  execute: (data: { instanceId: string; query: string; params?: any[]; timeout?: number; maxRows?: number }) =>
    api.post(`${API_BASE_URL}/query-console/execute`, data),
  explain: (data: { instanceId: string; query: string; analyze?: boolean; buffers?: boolean; format?: 'text' | 'json' }) =>
    api.post(`${API_BASE_URL}/query-console/explain`, data),
  format: (query: string) =>
    api.post(`${API_BASE_URL}/query-console/format`, { query }),
  getHistory: (filters?: any) => {
    const params = new URLSearchParams(filters).toString();
    return api.get(`${API_BASE_URL}/query-console/history?${params}`);
  },
  saveQuery: (data: { name: string; description?: string; query: string; instanceId?: string; isPublic?: boolean }) =>
    api.post(`${API_BASE_URL}/query-console/saved`, data),
  getSavedQueries: (instanceId?: string) => {
    const query = instanceId ? `?instanceId=${instanceId}` : '';
    return api.get(`${API_BASE_URL}/query-console/saved${query}`);
  },
  deleteSavedQuery: (id: string) =>
    api.delete(`${API_BASE_URL}/query-console/saved/${id}`),
  getAutocomplete: (instanceId: string, prefix: string, context: 'table' | 'column' | 'schema' | 'function' | 'keyword') =>
    api.get(`${API_BASE_URL}/query-console/autocomplete?instanceId=${instanceId}&prefix=${prefix}&context=${context}`),
};

// Extension API
export const extensionApi = {
  getExtensions: (instanceId: string, sortBy: 'name' | 'popularity' | 'recent' = 'name') => 
    api.get(`${API_BASE_URL}/extensions?instanceId=${instanceId}&sortBy=${sortBy}`),
  installExtension: (data: { instanceId: string; name: string; schema?: string; version?: string }) =>
    api.post(`${API_BASE_URL}/extensions`, data),
  removeExtension: (instanceId: string, name: string) => 
    api.delete(`${API_BASE_URL}/extensions/${name}?instanceId=${instanceId}`),
  installExtensionFromSql: (instanceId: string, sqlContent: string) =>
    api.post(`${API_BASE_URL}/extensions/install-sql`, { instanceId, sqlContent }),
};

// Settings API
export const settingsApi = {
  getSettings: () => api.get(`${API_BASE_URL}/settings`),
  updateSettings: (settings: Record<string, any>) => api.post(`${API_BASE_URL}/settings`, settings),
};

// Retention API
export const retentionApi = {
  getPolicies: (instanceId: string) => api.get(`${API_BASE_URL}/retention?instanceId=${instanceId}`),
  createPolicy: (data: any) => api.post(`${API_BASE_URL}/retention`, data),
  deletePolicy: (id: string) => api.delete(`${API_BASE_URL}/retention/${id}`),
  runPolicy: (id: string) => api.post(`${API_BASE_URL}/retention/${id}/run`, {}),
  updatePolicy: (id: string, data: any) => api.put(`${API_BASE_URL}/retention/${id}`, data),
};

// Set auth token
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  } else {
    delete api.defaults.headers.common['Authorization'];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }
};

// Initialize token from localStorage
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('auth_token');
  if (token) {
    setAuthToken(token);
  }
}

export default api;
