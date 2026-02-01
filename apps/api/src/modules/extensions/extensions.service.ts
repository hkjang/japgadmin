import { Injectable, Logger } from '@nestjs/common';
import { ConnectionManagerService } from '../core/services/connection-manager.service';

@Injectable()
export class ExtensionsService {
  private readonly logger = new Logger(ExtensionsService.name);

  private readonly POPULAR_EXTENSIONS = [
    'postgis',
    'pg_stat_statements',
    'timescaledb',
    'pgcrypto',
    'uuid-ossp',
    'postgres_fdw',
    'pg_cron',
    'pgaudit',
    'pg_partman',
    'citus',
    'hypopg',
    'pg_repack',
    'pg_trgm'
  ];

  private readonly TRENDING_EXTENSIONS = [
    'pgvector',
    'age', // Apache Age (Graph)
    'hydra', // Columnar
    'pg_graphql',
    'timescaledb'
  ];

  constructor(private readonly connectionManager: ConnectionManagerService) {}

  /**
   * List available and installed extensions for a specific instance
   */
  async getExtensions(instanceId: string, sortBy: 'name' | 'popularity' | 'recent' = 'name') {
    const query = `
      SELECT 
        name, 
        default_version, 
        installed_version, 
        comment
      FROM pg_available_extensions
      ORDER BY name ASC;
    `;

    try {
      const pool = await this.connectionManager.getPool(instanceId);
      if (!pool) {
        throw new Error(`Instance connection not found for ID: ${instanceId}`);
      }

      const result = await pool.query(`
        SELECT 
          name, 
          default_version, 
          installed_version, 
          comment 
        FROM pg_available_extensions 
      `); // Removed ORDER BY from SQL as sorting is done in application logic

      let extensions = result.rows;

      if (sortBy === 'popularity') {
        extensions.sort((a, b) => {
          const scoreA = this.POPULAR_EXTENSIONS.indexOf(a.name) !== -1 ? 1 : 0;
          const scoreB = this.POPULAR_EXTENSIONS.indexOf(b.name) !== -1 ? 1 : 0;
          if (scoreA !== scoreB) return scoreB - scoreA; // High score first
          return a.name.localeCompare(b.name);
        });
      } else if (sortBy === 'recent') {
         extensions.sort((a, b) => {
          const scoreA = this.TRENDING_EXTENSIONS.indexOf(a.name) !== -1 ? 1 : 0;
          const scoreB = this.TRENDING_EXTENSIONS.indexOf(b.name) !== -1 ? 1 : 0;
          if (scoreA !== scoreB) return scoreB - scoreA; // High score first
           return a.name.localeCompare(b.name);
        });
      } else { // Default to sorting by name if sortBy is 'name' or unrecognized
        extensions.sort((a, b) => a.name.localeCompare(b.name));
      }

      return extensions;
    } catch (error) {
      this.logger.error(`Failed to fetch extensions for instance ${instanceId}`, error);
      throw error;
    }
  }

  /**
   * Install an extension on a specific instance
   */
  async installExtension(instanceId: string, name: string, schema?: string, version?: string) {
    // Validate name to prevent SQL Injection (basic check + allow hyphens)
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        throw new Error('Invalid extension name');
    }

    let query = `CREATE EXTENSION IF NOT EXISTS "${name}"`;
    if (schema) {
       // Validate schema name
       if (!/^[a-zA-Z0-9_]+$/.test(schema)) {
           throw new Error('Invalid schema name');
       }
       query += ` SCHEMA "${schema}"`;
    }
    if (version) {
       // Validate version
       if (!/^[a-zA-Z0-9_.]+$/.test(version)) {
           throw new Error('Invalid version');
       }
       query += ` VERSION '${version}'`;
    }

    try {
      await this.connectionManager.executeQuery(instanceId, query);
      return { message: `Extension ${name} installed successfully` };
    } catch (error) {
      this.logger.error(`Failed to install extension ${name} on instance ${instanceId}`, error);
      throw error;
    }
  }

  /**
   * Remove an extension from a specific instance
   */
  async removeExtension(instanceId: string, name: string) {
    // Validate name
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
        throw new Error('Invalid extension name');
    }

    const query = `DROP EXTENSION IF EXISTS "${name}"`;

    try {
      await this.connectionManager.executeQuery(instanceId, query);
      return { message: `Extension ${name} removed successfully` };
    } catch (error) {
      this.logger.error(`Failed to remove extension ${name} from instance ${instanceId}`, error);
      throw error;
    }
  }

  /**
   * Install extension from SQL content (Offline support)
   */
  async installExtensionFromSql(instanceId: string, sqlContent: string) {
    if (!sqlContent || sqlContent.trim().length === 0) {
      throw new Error('SQL content is empty');
    }

    // Wrap in transaction? ConnectionManager doesn't expose transaction directly easily without client.
    // executeQuery uses a pool client. 
    // Ideally we should run this as a single script.
    
    try {
      await this.connectionManager.executeQuery(instanceId, sqlContent);
      return { message: 'Extension SQL executed successfully' };
    } catch (error) {
      this.logger.error(`Failed to execute extension SQL on instance ${instanceId}`, error);
      throw error;
    }
  }
}
