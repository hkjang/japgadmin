import { Injectable, Logger } from '@nestjs/common';
import { ConnectionManagerService } from '../core/services/connection-manager.service';

export interface SchemaInfo {
  name: string;
  owner: string;
  tableCount: number;
  viewCount: number;
  functionCount: number;
}

export interface TableInfo {
  schema: string;
  name: string;
  type: 'table' | 'view' | 'materialized view' | 'foreign table';
  owner: string;
  rowCount: number;
  sizeBytes: number;
  sizePretty: string;
  hasIndexes: boolean;
  hasTriggers: boolean;
  description: string;
}

export interface ColumnInfo {
  ordinalPosition: number;
  name: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  columnDefault: string;
  maxLength: number;
  numericPrecision: number;
  numericScale: number;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  description: string;
}

export interface IndexInfo {
  name: string;
  schema: string;
  tableName: string;
  isUnique: boolean;
  isPrimary: boolean;
  columns: string[];
  indexType: string;
  sizeBytes: number;
  sizePretty: string;
  indexDef: string;
  isValid: boolean;
}

export interface ForeignKeyInfo {
  constraintName: string;
  schema: string;
  tableName: string;
  columnName: string;
  foreignSchema: string;
  foreignTable: string;
  foreignColumn: string;
  updateRule: string;
  deleteRule: string;
}

export interface FunctionInfo {
  schema: string;
  name: string;
  arguments: string;
  returnType: string;
  language: string;
  type: string;
  volatility: string;
  owner: string;
  description: string;
}

@Injectable()
export class SchemaBrowserService {
  private readonly logger = new Logger(SchemaBrowserService.name);

  constructor(private readonly connectionManager: ConnectionManagerService) {}

  /**
   * Get all schemas in a database
   */
  async getSchemas(instanceId: string, database: string): Promise<SchemaInfo[]> {
    const query = `
      SELECT
        n.nspname AS name,
        pg_get_userbyid(n.nspowner) AS owner,
        (SELECT COUNT(*) FROM pg_class c WHERE c.relnamespace = n.oid AND c.relkind = 'r') AS table_count,
        (SELECT COUNT(*) FROM pg_class c WHERE c.relnamespace = n.oid AND c.relkind = 'v') AS view_count,
        (SELECT COUNT(*) FROM pg_proc p WHERE p.pronamespace = n.oid) AS function_count
      FROM pg_namespace n
      WHERE n.nspname NOT LIKE 'pg_%'
        AND n.nspname != 'information_schema'
      ORDER BY n.nspname
    `;

    const result = await this.connectionManager.executeQuery(instanceId, query);
    return result.rows.map(row => ({
      name: row.name,
      owner: row.owner,
      tableCount: parseInt(row.table_count, 10),
      viewCount: parseInt(row.view_count, 10),
      functionCount: parseInt(row.function_count, 10),
    }));
  }

  /**
   * Get all tables in a schema
   */
  async getTables(instanceId: string, schema: string = 'public', options?: {
    includeViews?: boolean;
    search?: string;
  }): Promise<TableInfo[]> {
    let relkindFilter = `'r'`;
    if (options?.includeViews) {
      relkindFilter = `'r', 'v', 'm', 'f'`;
    }

    let query = `
      SELECT
        n.nspname AS schema,
        c.relname AS name,
        CASE c.relkind
          WHEN 'r' THEN 'table'
          WHEN 'v' THEN 'view'
          WHEN 'm' THEN 'materialized view'
          WHEN 'f' THEN 'foreign table'
        END AS type,
        pg_get_userbyid(c.relowner) AS owner,
        COALESCE(s.n_live_tup, 0) AS row_count,
        pg_total_relation_size(c.oid) AS size_bytes,
        pg_size_pretty(pg_total_relation_size(c.oid)) AS size_pretty,
        EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid = c.oid) AS has_indexes,
        EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid = c.oid) AS has_triggers,
        COALESCE(obj_description(c.oid, 'pg_class'), '') AS description
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE n.nspname = $1
        AND c.relkind IN (${relkindFilter})
    `;

    const params: any[] = [schema];

    if (options?.search) {
      query += ` AND c.relname ILIKE $2`;
      params.push(`%${options.search}%`);
    }

    query += ` ORDER BY c.relname`;

    const result = await this.connectionManager.executeQuery(instanceId, query, params);
    return result.rows.map(row => ({
      schema: row.schema,
      name: row.name,
      type: row.type,
      owner: row.owner,
      rowCount: parseInt(row.row_count, 10),
      sizeBytes: parseInt(row.size_bytes, 10),
      sizePretty: row.size_pretty,
      hasIndexes: row.has_indexes,
      hasTriggers: row.has_triggers,
      description: row.description,
    }));
  }

  /**
   * Get columns for a table
   */
  async getColumns(instanceId: string, schema: string, table: string): Promise<ColumnInfo[]> {
    const query = `
      SELECT
        c.ordinal_position,
        c.column_name AS name,
        c.data_type,
        c.udt_name,
        c.is_nullable = 'YES' AS is_nullable,
        c.column_default,
        c.character_maximum_length AS max_length,
        c.numeric_precision,
        c.numeric_scale,
        EXISTS(
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = c.table_schema
            AND tc.table_name = c.table_name
            AND kcu.column_name = c.column_name
            AND tc.constraint_type = 'PRIMARY KEY'
        ) AS is_primary_key,
        EXISTS(
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = c.table_schema
            AND tc.table_name = c.table_name
            AND kcu.column_name = c.column_name
            AND tc.constraint_type = 'FOREIGN KEY'
        ) AS is_foreign_key,
        COALESCE(col_description(
          (SELECT oid FROM pg_class WHERE relname = c.table_name AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = c.table_schema)),
          c.ordinal_position
        ), '') AS description
      FROM information_schema.columns c
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position
    `;

    const result = await this.connectionManager.executeQuery(instanceId, query, [schema, table]);
    return result.rows.map(row => ({
      ordinalPosition: parseInt(row.ordinal_position, 10),
      name: row.name,
      dataType: row.data_type,
      udtName: row.udt_name,
      isNullable: row.is_nullable,
      columnDefault: row.column_default,
      maxLength: row.max_length ? parseInt(row.max_length, 10) : null,
      numericPrecision: row.numeric_precision ? parseInt(row.numeric_precision, 10) : null,
      numericScale: row.numeric_scale ? parseInt(row.numeric_scale, 10) : null,
      isPrimaryKey: row.is_primary_key,
      isForeignKey: row.is_foreign_key,
      description: row.description,
    }));
  }

  /**
   * Get indexes for a table
   */
  async getIndexes(instanceId: string, schema: string, table: string): Promise<IndexInfo[]> {
    const query = `
      SELECT
        i.relname AS name,
        n.nspname AS schema,
        t.relname AS table_name,
        ix.indisunique AS is_unique,
        ix.indisprimary AS is_primary,
        array_agg(a.attname ORDER BY x.ordinality) AS columns,
        am.amname AS index_type,
        pg_relation_size(i.oid) AS size_bytes,
        pg_size_pretty(pg_relation_size(i.oid)) AS size_pretty,
        pg_get_indexdef(i.oid) AS index_def,
        ix.indisvalid AS is_valid
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_am am ON am.oid = i.relam
      CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ordinality)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
      WHERE n.nspname = $1 AND t.relname = $2
      GROUP BY i.relname, n.nspname, t.relname, ix.indisunique, ix.indisprimary, am.amname, i.oid, ix.indisvalid
      ORDER BY i.relname
    `;

    const result = await this.connectionManager.executeQuery(instanceId, query, [schema, table]);
    return result.rows.map(row => ({
      name: row.name,
      schema: row.schema,
      tableName: row.table_name,
      isUnique: row.is_unique,
      isPrimary: row.is_primary,
      columns: row.columns,
      indexType: row.index_type,
      sizeBytes: parseInt(row.size_bytes, 10),
      sizePretty: row.size_pretty,
      indexDef: row.index_def,
      isValid: row.is_valid,
    }));
  }

  /**
   * Get foreign keys for a table
   */
  async getForeignKeys(instanceId: string, schema: string, table: string): Promise<ForeignKeyInfo[]> {
    const query = `
      SELECT
        tc.constraint_name,
        tc.table_schema AS schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_schema AS foreign_schema,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
      ORDER BY tc.constraint_name
    `;

    const result = await this.connectionManager.executeQuery(instanceId, query, [schema, table]);
    return result.rows.map(row => ({
      constraintName: row.constraint_name,
      schema: row.schema,
      tableName: row.table_name,
      columnName: row.column_name,
      foreignSchema: row.foreign_schema,
      foreignTable: row.foreign_table,
      foreignColumn: row.foreign_column,
      updateRule: row.update_rule,
      deleteRule: row.delete_rule,
    }));
  }

  /**
   * Get functions in a schema
   */
  async getFunctions(instanceId: string, schema: string = 'public'): Promise<FunctionInfo[]> {
    const query = `
      SELECT
        n.nspname AS schema,
        p.proname AS name,
        pg_get_function_arguments(p.oid) AS arguments,
        pg_get_function_result(p.oid) AS return_type,
        l.lanname AS language,
        CASE p.prokind
          WHEN 'f' THEN 'function'
          WHEN 'p' THEN 'procedure'
          WHEN 'a' THEN 'aggregate'
          WHEN 'w' THEN 'window'
        END AS type,
        CASE p.provolatile
          WHEN 'i' THEN 'immutable'
          WHEN 's' THEN 'stable'
          WHEN 'v' THEN 'volatile'
        END AS volatility,
        pg_get_userbyid(p.proowner) AS owner,
        COALESCE(obj_description(p.oid, 'pg_proc'), '') AS description
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang
      WHERE n.nspname = $1
      ORDER BY p.proname
    `;

    const result = await this.connectionManager.executeQuery(instanceId, query, [schema]);
    return result.rows as FunctionInfo[];
  }

  /**
   * Get DDL for a table
   */
  async getTableDdl(instanceId: string, schema: string, table: string): Promise<string> {
    // Get column definitions
    const columns = await this.getColumns(instanceId, schema, table);
    const indexes = await this.getIndexes(instanceId, schema, table);
    const foreignKeys = await this.getForeignKeys(instanceId, schema, table);

    let ddl = `CREATE TABLE ${schema}.${table} (\n`;

    // Columns
    const columnDefs = columns.map(col => {
      let def = `  ${col.name} ${col.dataType}`;

      if (col.maxLength) {
        def += `(${col.maxLength})`;
      } else if (col.numericPrecision && col.numericScale !== null) {
        def += `(${col.numericPrecision}, ${col.numericScale})`;
      }

      if (!col.isNullable) {
        def += ' NOT NULL';
      }

      if (col.columnDefault) {
        def += ` DEFAULT ${col.columnDefault}`;
      }

      return def;
    });

    // Primary key constraint
    const pkColumns = columns.filter(c => c.isPrimaryKey).map(c => c.name);
    if (pkColumns.length > 0) {
      columnDefs.push(`  PRIMARY KEY (${pkColumns.join(', ')})`);
    }

    // Foreign key constraints
    for (const fk of foreignKeys) {
      columnDefs.push(
        `  FOREIGN KEY (${fk.columnName}) REFERENCES ${fk.foreignSchema}.${fk.foreignTable}(${fk.foreignColumn}) ON UPDATE ${fk.updateRule} ON DELETE ${fk.deleteRule}`
      );
    }

    ddl += columnDefs.join(',\n');
    ddl += '\n);\n\n';

    // Indexes (non-primary)
    for (const idx of indexes.filter(i => !i.isPrimary)) {
      ddl += `${idx.indexDef};\n`;
    }

    return ddl;
  }

  /**
   * Get DDL for an index
   */
  async getIndexDdl(instanceId: string, schema: string, indexName: string): Promise<string> {
    const query = `
      SELECT pg_get_indexdef(i.oid) AS index_def
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = i.relnamespace
      WHERE n.nspname = $1 AND i.relname = $2
    `;

    const result = await this.connectionManager.executeQuery(instanceId, query, [schema, indexName]);
    return result.rows[0]?.index_def || '';
  }

  /**
   * Get DDL for a function
   */
  async getFunctionDdl(instanceId: string, schema: string, functionName: string, argTypes?: string): Promise<string> {
    let query: string;
    let params: any[];

    if (argTypes) {
      query = `
        SELECT pg_get_functiondef(p.oid) AS function_def
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = $1 AND p.proname = $2 AND pg_get_function_arguments(p.oid) = $3
      `;
      params = [schema, functionName, argTypes];
    } else {
      query = `
        SELECT pg_get_functiondef(p.oid) AS function_def
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = $1 AND p.proname = $2
        LIMIT 1
      `;
      params = [schema, functionName];
    }

    const result = await this.connectionManager.executeQuery(instanceId, query, params);
    return result.rows[0]?.function_def || '';
  }

  /**
   * Search for objects across all schemas
   */
  async searchObjects(instanceId: string, search: string, limit: number = 50): Promise<{
    tables: { schema: string; name: string; type: string }[];
    columns: { schema: string; table: string; name: string; dataType: string }[];
    functions: { schema: string; name: string; arguments: string }[];
  }> {
    const tablesQuery = `
      SELECT n.nspname AS schema, c.relname AS name,
        CASE c.relkind WHEN 'r' THEN 'table' WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized view' END AS type
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'v', 'm')
        AND n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema'
        AND c.relname ILIKE $1
      LIMIT $2
    `;

    const columnsQuery = `
      SELECT c.table_schema AS schema, c.table_name AS table, c.column_name AS name, c.data_type
      FROM information_schema.columns c
      WHERE c.table_schema NOT LIKE 'pg_%' AND c.table_schema != 'information_schema'
        AND c.column_name ILIKE $1
      LIMIT $2
    `;

    const functionsQuery = `
      SELECT n.nspname AS schema, p.proname AS name, pg_get_function_arguments(p.oid) AS arguments
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema'
        AND p.proname ILIKE $1
      LIMIT $2
    `;

    const searchPattern = `%${search}%`;

    const [tables, columns, functions] = await Promise.all([
      this.connectionManager.executeQuery(instanceId, tablesQuery, [searchPattern, limit]),
      this.connectionManager.executeQuery(instanceId, columnsQuery, [searchPattern, limit]),
      this.connectionManager.executeQuery(instanceId, functionsQuery, [searchPattern, limit]),
    ]);

    return {
      tables: tables.rows,
      columns: columns.rows,
      functions: functions.rows,
    };
  }
}
