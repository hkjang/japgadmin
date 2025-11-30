import axios from 'axios';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const TARGET_DB_URL = process.env.TARGET_DB_URL;

if (!TARGET_DB_URL) {
  console.error('TARGET_DB_URL is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: TARGET_DB_URL,
});

async function collectMetrics() {
  try {
    // 1. Collect Activity
    const activityRes = await pool.query(`
      SELECT count(*) as active_connections 
      FROM pg_stat_activity 
      WHERE state = 'active'
    `);
    
    // 2. Send to API (Example: triggering a refresh or sending raw data if API supports it)
    // In this architecture, the API pulls data, but the agent could push specific metrics
    // For now, let's simulate a heartbeat or specific check
    
    console.log(`[${new Date().toISOString()}] Agent heartbeat: Active connections = ${activityRes.rows[0].active_connections}`);
    
    // Here we could implement push-based monitoring if needed
    // await axios.post(`${API_URL}/monitoring/heartbeat`, { ... });

  } catch (error: any) {
    console.error('Error collecting metrics:', error.message);
  }
}

async function startAgent() {
  console.log('🚀 Starting PostgreSQL Monitoring Agent...');
  
  // Initial check
  await collectMetrics();

  // Schedule every 5 seconds
  setInterval(collectMetrics, 5000);
}

startAgent().catch(console.error);
