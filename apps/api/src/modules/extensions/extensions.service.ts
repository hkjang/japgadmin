import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from '../../database/postgres.service';

@Injectable()
export class ExtensionsService {
  private readonly logger = new Logger(ExtensionsService.name);

  constructor(private readonly postgresService: PostgresService) {}

  /**
   * List available and installed extensions
   */
  async getExtensions() {
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
      const result = await this.postgresService.query(query);
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to fetch extensions', error);
      throw error;
    }
  }

  /**
   * Install an extension
   */
  async installExtension(name: string, schema?: string, version?: string) {
    // Validate name to prevent SQL Injection (basic check)
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
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
      await this.postgresService.query(query);
      return { message: `Extension ${name} installed successfully` };
    } catch (error) {
      this.logger.error(`Failed to install extension ${name}`, error);
      throw error;
    }
  }

  /**
   * Remove an extension
   */
  async removeExtension(name: string) {
    // Validate name
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
        throw new Error('Invalid extension name');
    }

    const query = `DROP EXTENSION IF EXISTS "${name}"`;

    try {
      await this.postgresService.query(query);
      return { message: `Extension ${name} removed successfully` };
    } catch (error) {
      this.logger.error(`Failed to remove extension ${name}`, error);
      throw error;
    }
  }
}
