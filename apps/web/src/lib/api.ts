import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export default api;
