import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class PostgresService {
  private pool: Pool;

  constructor(private configService: ConfigService) {
    this.pool = new Pool({
      host: this.configService.get('TARGET_DB_HOST'),
      port: parseInt(this.configService.get('TARGET_DB_PORT') || '5432'),
      user: this.configService.get('TARGET_DB_USER'),
      password: this.configService.get('TARGET_DB_PASSWORD'),
      database: this.configService.get('TARGET_DB_NAME'),
      max: 10, // 최대 연결 수
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    console.log('✅ PostgreSQL connection pool created for Target DB');
  }

  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const result = await this.pool.query(text, params);
    return { rows: result.rows, rowCount: result.rowCount || 0 };
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}
