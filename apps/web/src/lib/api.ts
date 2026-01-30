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

export const monitoringApi = {
  getActivity: () => axios.get(`${API_BASE_URL}/monitoring/activity`),
  getDatabaseStats: () => axios.get(`${API_BASE_URL}/monitoring/database`),
  getWaitEvents: () => axios.get(`${API_BASE_URL}/monitoring/wait-events`),
  getTableSizes: () => axios.get(`${API_BASE_URL}/monitoring/table-sizes`),
  getBgwriterStats: () => axios.get(`${API_BASE_URL}/monitoring/bgwriter`),
  getConnectionStats: () => axios.get(`${API_BASE_URL}/monitoring/connection-stats`),
  getTxidWraparound: () => axios.get(`${API_BASE_URL}/monitoring/txid-wraparound`),
  getLocks: () => axios.get(`${API_BASE_URL}/monitoring/locks`),
  getPerformanceHistory: () => axios.get(`${API_BASE_URL}/monitoring/performance-history`),
  getDiskUsage: () => axios.get(`${API_BASE_URL}/monitoring/disk-usage`),
  getReplicationStatus: () => axios.get(`${API_BASE_URL}/monitoring/replication-status`),
};

export const vacuumApi = {
  execute: (tableName: string, vacuumType: 'VACUUM' | 'VACUUM FULL' | 'ANALYZE') => 
    axios.post(`${API_BASE_URL}/vacuum/execute`, { tableName, vacuumType }),
  getHistory: () => axios.get(`${API_BASE_URL}/vacuum/history`),
  getAutovacuumStats: () => axios.get(`${API_BASE_URL}/vacuum/autovacuum`),
  getTableStats: () => axios.get(`${API_BASE_URL}/vacuum/table-stats`),
};

export const queryApi = {
  getSlowQueries: () => axios.get(`${API_BASE_URL}/query/slow`),
  explain: (query: string) => axios.post(`${API_BASE_URL}/query/explain`, { query }),
  getHistory: () => axios.get(`${API_BASE_URL}/query/history`),
  getStats: () => axios.get(`${API_BASE_URL}/query/stats`),
};

export const alertApi = {
  getConfigs: () => axios.get(`${API_BASE_URL}/alert/configs`),
  createConfig: (data: any) => axios.post(`${API_BASE_URL}/alert/configs`, data),
  updateConfig: (id: string, data: any) => axios.put(`${API_BASE_URL}/alert/configs/${id}`, data),
  deleteConfig: (id: string) => axios.delete(`${API_BASE_URL}/alert/configs/${id}`),
  getHistory: () => axios.get(`${API_BASE_URL}/alert/history`),
  test: (id: string) => axios.post(`${API_BASE_URL}/alert/test`, { id }),
};

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    axios.post(`${API_BASE_URL}/auth/login`, { username, password }),
  logout: () => axios.post(`${API_BASE_URL}/auth/logout`),
  getProfile: () => axios.get(`${API_BASE_URL}/auth/profile`),
  register: (data: { username: string; email: string; password: string }) =>
    axios.post(`${API_BASE_URL}/auth/register`, data),
};

// Inventory API
export const inventoryApi = {
  // Clusters
  getClusters: () => axios.get(`${API_BASE_URL}/clusters`),
  getCluster: (id: string) => axios.get(`${API_BASE_URL}/clusters/${id}`),
  createCluster: (data: any) => axios.post(`${API_BASE_URL}/clusters`, data),
  updateCluster: (id: string, data: any) => axios.put(`${API_BASE_URL}/clusters/${id}`, data),
  deleteCluster: (id: string) => axios.delete(`${API_BASE_URL}/clusters/${id}`),

  // Instances
  getInstances: (clusterId?: string) => {
    const query = clusterId ? `?clusterId=${clusterId}` : '';
    return axios.get(`${API_BASE_URL}/instances${query}`);
  },
  getInstance: (id: string) => axios.get(`${API_BASE_URL}/instances/${id}`),
  createInstance: (data: any) => axios.post(`${API_BASE_URL}/instances`, data),
  updateInstance: (id: string, data: any) => axios.put(`${API_BASE_URL}/instances/${id}`, data),
  deleteInstance: (id: string) => axios.delete(`${API_BASE_URL}/instances/${id}`),
  testConnection: (id: string) => axios.post(`${API_BASE_URL}/instances/${id}/test`),

  // Databases
  getDatabases: (instanceId: string) => axios.get(`${API_BASE_URL}/instances/${instanceId}/databases`),
  discoverDatabases: (instanceId: string) =>
    axios.post(`${API_BASE_URL}/instances/${instanceId}/databases/discover`),
};

// Session API
export const sessionApi = {
  getSessions: (instanceId: string) => axios.get(`${API_BASE_URL}/instances/${instanceId}/sessions`),
  cancelQuery: (instanceId: string, pid: number) =>
    axios.post(`${API_BASE_URL}/instances/${instanceId}/sessions/${pid}/cancel`),
  terminateSession: (instanceId: string, pid: number) =>
    axios.post(`${API_BASE_URL}/instances/${instanceId}/sessions/${pid}/terminate`),
  getBlockingInfo: (instanceId: string) =>
    axios.get(`${API_BASE_URL}/instances/${instanceId}/sessions/blocking`),
};

// Lock API
export const lockApi = {
  getLocks: (instanceId: string) => axios.get(`${API_BASE_URL}/instances/${instanceId}/locks`),
  getBlockingTree: (instanceId: string) =>
    axios.get(`${API_BASE_URL}/instances/${instanceId}/locks/blocking-tree`),
  detectDeadlocks: (instanceId: string) =>
    axios.get(`${API_BASE_URL}/instances/${instanceId}/locks/deadlocks`),
};

// Schema Browser API
export const schemaApi = {
  getSchemas: (instanceId: string) => axios.get(`${API_BASE_URL}/instances/${instanceId}/schema/schemas`),
  getTables: (instanceId: string, schema?: string) => {
    const query = schema ? `?schema=${schema}` : '';
    return axios.get(`${API_BASE_URL}/instances/${instanceId}/schema/tables${query}`);
  },
  getTableColumns: (instanceId: string, schema: string, table: string) =>
    axios.get(`${API_BASE_URL}/instances/${instanceId}/schema/tables/${schema}/${table}/columns`),
  getIndexes: (instanceId: string, schema?: string, table?: string) => {
    const params = new URLSearchParams();
    if (schema) params.set('schema', schema);
    if (table) params.set('table', table);
    return axios.get(`${API_BASE_URL}/instances/${instanceId}/schema/indexes?${params}`);
  },
  getDDL: (instanceId: string, schema: string, table: string) =>
    axios.get(`${API_BASE_URL}/instances/${instanceId}/schema/ddl?schema=${schema}&table=${table}`),
  searchObjects: (instanceId: string, query: string) =>
    axios.get(`${API_BASE_URL}/instances/${instanceId}/schema/search?query=${query}`),
};

// Users & Roles API
export const usersApi = {
  getUsers: () => axios.get(`${API_BASE_URL}/users`),
  getUser: (id: string) => axios.get(`${API_BASE_URL}/users/${id}`),
  createUser: (data: any) => axios.post(`${API_BASE_URL}/users`, data),
  updateUser: (id: string, data: any) => axios.put(`${API_BASE_URL}/users/${id}`, data),
  deleteUser: (id: string) => axios.delete(`${API_BASE_URL}/users/${id}`),
  getRoles: () => axios.get(`${API_BASE_URL}/roles`),
  assignRole: (userId: string, roleId: string, scope?: any) =>
    axios.post(`${API_BASE_URL}/users/${userId}/roles`, { roleId, scope }),
  removeRole: (userId: string, roleId: string) =>
    axios.delete(`${API_BASE_URL}/users/${userId}/roles/${roleId}`),
};

// Backup API
export const backupApi = {
  getConfigs: (instanceId?: string) => {
    const query = instanceId ? `?instanceId=${instanceId}` : '';
    return axios.get(`${API_BASE_URL}/backups/configs${query}`);
  },
  createConfig: (data: any) => axios.post(`${API_BASE_URL}/backups/configs`, data),
  updateConfig: (id: string, data: any) => axios.put(`${API_BASE_URL}/backups/configs/${id}`, data),
  deleteConfig: (id: string) => axios.delete(`${API_BASE_URL}/backups/configs/${id}`),
  getBackups: (filters?: any) => {
    const params = new URLSearchParams(filters).toString();
    return axios.get(`${API_BASE_URL}/backups?${params}`);
  },
  createBackup: (data: any) => axios.post(`${API_BASE_URL}/backups`, data),
  deleteBackup: (id: string) => axios.delete(`${API_BASE_URL}/backups/${id}`),
  getStatistics: (instanceId?: string) => {
    const query = instanceId ? `?instanceId=${instanceId}` : '';
    return axios.get(`${API_BASE_URL}/backups/statistics${query}`);
  },
  getPitrRange: (instanceId: string) =>
    axios.get(`${API_BASE_URL}/backups/pitr/${instanceId}/range`),
};

// Replication API
export const replicationApi = {
  getStatus: (instanceId: string) =>
    axios.get(`${API_BASE_URL}/replication/instances/${instanceId}/status`),
  getStandbys: (instanceId: string) =>
    axios.get(`${API_BASE_URL}/replication/instances/${instanceId}/standbys`),
  getSlots: (instanceId: string) =>
    axios.get(`${API_BASE_URL}/replication/instances/${instanceId}/slots`),
  getHealth: (instanceId: string) =>
    axios.get(`${API_BASE_URL}/replication/instances/${instanceId}/health`),
  getClusterTopology: (clusterId: string) =>
    axios.get(`${API_BASE_URL}/replication/clusters/${clusterId}/topology`),
  createSlot: (instanceId: string, slotName: string, isLogical?: boolean) =>
    axios.post(`${API_BASE_URL}/replication/instances/${instanceId}/slots`, { slotName, isLogical }),
  dropSlot: (instanceId: string, slotName: string) =>
    axios.delete(`${API_BASE_URL}/replication/instances/${instanceId}/slots/${slotName}`),
  pauseWalReplay: (instanceId: string) =>
    axios.post(`${API_BASE_URL}/replication/instances/${instanceId}/wal/pause`),
  resumeWalReplay: (instanceId: string) =>
    axios.post(`${API_BASE_URL}/replication/instances/${instanceId}/wal/resume`),
};

// Failover API
export const failoverApi = {
  checkReadiness: (clusterId: string) =>
    axios.get(`${API_BASE_URL}/failover/clusters/${clusterId}/readiness`),
  initiateFailover: (data: any) => axios.post(`${API_BASE_URL}/failover`, data),
  initiateSwitchover: (clusterId: string, newPrimaryId: string) =>
    axios.post(`${API_BASE_URL}/failover/switchover`, { clusterId, newPrimaryId }),
  getHistory: (filters?: any) => {
    const params = new URLSearchParams(filters).toString();
    return axios.get(`${API_BASE_URL}/failover/history?${params}`);
  },
  getConfig: (clusterId: string) =>
    axios.get(`${API_BASE_URL}/failover/clusters/${clusterId}/config`),
  updateConfig: (clusterId: string, data: any) =>
    axios.put(`${API_BASE_URL}/failover/clusters/${clusterId}/config`, data),
};

// Audit API
export const auditApi = {
  getLogs: (filters?: any) => {
    const params = new URLSearchParams(filters).toString();
    return axios.get(`${API_BASE_URL}/audit/logs?${params}`);
  },
  getLog: (id: string) => axios.get(`${API_BASE_URL}/audit/logs/${id}`),
  getUserActivity: (userId: string, days?: number) => {
    const query = days ? `?days=${days}` : '';
    return axios.get(`${API_BASE_URL}/audit/users/${userId}/activity${query}`);
  },
  getStatistics: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return axios.get(`${API_BASE_URL}/audit/statistics?${params}`);
  },
  getSecurityAnomalies: () => axios.get(`${API_BASE_URL}/audit/security/anomalies`),
  getComplianceReport: (startDate: string, endDate: string) =>
    axios.get(`${API_BASE_URL}/audit/compliance/report?startDate=${startDate}&endDate=${endDate}`),
};

// Task API
export const taskApi = {
  getTasks: (filters?: any) => {
    const params = new URLSearchParams(filters).toString();
    return axios.get(`${API_BASE_URL}/tasks?${params}`);
  },
  getTask: (id: string) => axios.get(`${API_BASE_URL}/tasks/${id}`),
  createTask: (data: any) => axios.post(`${API_BASE_URL}/tasks`, data),
  cancelTask: (id: string) => axios.post(`${API_BASE_URL}/tasks/${id}/cancel`),
  retryTask: (id: string) => axios.post(`${API_BASE_URL}/tasks/${id}/retry`),
  getQueueStats: () => axios.get(`${API_BASE_URL}/tasks/stats`),
  getActiveJobs: () => axios.get(`${API_BASE_URL}/tasks/active`),
  getFailedJobs: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return axios.get(`${API_BASE_URL}/tasks/failed${query}`);
  },
  // Schedules
  getSchedules: (instanceId?: string) => {
    const query = instanceId ? `?instanceId=${instanceId}` : '';
    return axios.get(`${API_BASE_URL}/tasks/schedules${query}`);
  },
  createSchedule: (data: any) => axios.post(`${API_BASE_URL}/tasks/schedules`, data),
  updateSchedule: (id: string, data: any) => axios.put(`${API_BASE_URL}/tasks/schedules/${id}`, data),
  deleteSchedule: (id: string) => axios.delete(`${API_BASE_URL}/tasks/schedules/${id}`),
  toggleSchedule: (id: string) => axios.post(`${API_BASE_URL}/tasks/schedules/${id}/toggle`),
};

// Query Console API
export const queryConsoleApi = {
  execute: (data: { instanceId: string; query: string; params?: any[]; timeout?: number; maxRows?: number }) =>
    axios.post(`${API_BASE_URL}/query-console/execute`, data),
  explain: (data: { instanceId: string; query: string; analyze?: boolean; buffers?: boolean; format?: 'text' | 'json' }) =>
    axios.post(`${API_BASE_URL}/query-console/explain`, data),
  format: (query: string) =>
    axios.post(`${API_BASE_URL}/query-console/format`, { query }),
  getHistory: (filters?: any) => {
    const params = new URLSearchParams(filters).toString();
    return axios.get(`${API_BASE_URL}/query-console/history?${params}`);
  },
  saveQuery: (data: { name: string; description?: string; query: string; instanceId?: string; isPublic?: boolean }) =>
    axios.post(`${API_BASE_URL}/query-console/saved`, data),
  getSavedQueries: (instanceId?: string) => {
    const query = instanceId ? `?instanceId=${instanceId}` : '';
    return axios.get(`${API_BASE_URL}/query-console/saved${query}`);
  },
  deleteSavedQuery: (id: string) =>
    axios.delete(`${API_BASE_URL}/query-console/saved/${id}`),
  getAutocomplete: (instanceId: string, prefix: string, context: 'table' | 'column' | 'schema' | 'function' | 'keyword') =>
    axios.get(`${API_BASE_URL}/query-console/autocomplete?instanceId=${instanceId}&prefix=${prefix}&context=${context}`),
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
