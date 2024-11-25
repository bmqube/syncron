import type { Client as ClientType } from 'pg';
import pg from 'pg';
import { ColumnType, DatabaseAdapter, DatabaseType, IndexType, Sequences, TableMetadataWithData, UserDefinedEnumTypes, ViewType } from '../../types.mjs';
import { appendFileSync, writeFileSync } from 'fs';

const { Client } = pg;

export class PostgresAdapter implements DatabaseAdapter {
    private client: ClientType;
    private uri: string;
    private db: string;
    private schema: string;

    constructor(uri: string, schema?: string) {
        this.uri = uri;
        this.client = new Client(uri);
        this.db = uri.split('/').pop()!!;
        this.schema = schema || 'public';
    }

    async connect(): Promise<void> {
        await this.client.connect();
    }

    async disconnect(): Promise<void> {
        await this.client.end();
    }

    private getSQLType(column: ColumnType): string {
        let type = column.data_type;
        if (column.character_maximum_length) {
            type = `${type}(${column.character_maximum_length})`;
        }

        if (type.startsWith('_')) {
            type = type.replace(/_/g, '');
            type = `${type}[]`;
        }
        return type;
    };

    private parseJSONArray(data: any[]): string {
        return data.map((item) => {
            const jsonString = JSON.stringify(item);
            const escapedJson = JSON.stringify(jsonString);
            return escapedJson;
        }).join(',');
    }

    private generateSQLForCreatingTables(tableName: string, data: ColumnType[]): string {
        const columns = data.map(col => {
            let columnDef = `  ${col.column_name} ${col.data_type}`;

            if (col.is_primary) {
                columnDef += ' PRIMARY KEY';
            }

            if (col.is_nullable === 'NO') {
                columnDef += ' NOT NULL';
            }

            if (col.column_default !== null) {
                columnDef += ` DEFAULT ${col.column_default}`;
            }

            if (col.foreign_key) {
                columnDef += ` REFERENCES ${col.foreign_key.table_name}(${col.foreign_key.column_name})`;
            }

            if (col.is_unique) {
                columnDef += ' UNIQUE';
            }

            return columnDef;
        }).join(',\n');

        appendFileSync('./test/create.sql', `CREATE TABLE IF NOT EXISTS ${tableName} (\n${columns}\n);\n\n`);

        return `CREATE TABLE IF NOT EXISTS ${tableName} (\n${columns}\n);\n\n`;
    }

    private generateSQLForInsertingData(table: TableMetadataWithData): string {
        if (!table.data || table.data.length === 0) return "";

        const tableName = table.table_name;
        const columnNames = Object.keys(table.data[0]).join(', ');

        const values = table.data.map((row) => {
            const rowValues = Object.entries(row).map(([key, value]) => {
                if (value === null) return 'NULL';

                const data_type = this.getSQLType(table.columns.find(col => col.column_name === key)!!);

                if (typeof value === 'object') {
                    if (Array.isArray(value)) {
                        if (data_type === 'json[]' || data_type === 'jsonb[]') {
                            return `'{${this.parseJSONArray(value)}}'::${data_type}`;
                        }

                        return `'{${value.join(',')}}'::${data_type}`;
                    }

                    return `'${JSON.stringify(value)}'::${data_type}`;
                }

                if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;

                return value;
            });
            return `(${rowValues.join(', ')})`;
        }).join(',\n');

        // appendFileSync('./test/insert.sql', `INSERT INTO ${tableName} (${columnNames}) VALUES\n${values};\n\n`);

        return `INSERT INTO ${tableName} (${columnNames}) VALUES\n${values};\n\n`;
    }

    private generateSQLForCreatingIndexes(index: IndexType): string {
        const indexStatement = `CREATE ${index.is_unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${index.index_name} ON ${index.table_name} USING ${index.index_type} (${index.column_name});`;

        appendFileSync('./test/index.sql', `${indexStatement}\n\n`);

        return indexStatement;
    }

    private generateSQLForCreatingViews(view: ViewType): string {
        return `
                    DROP VIEW IF EXISTS ${view.name} CASCADE;
                    CREATE VIEW ${view.name} AS ${view.definition};
                `;
    }

    private generateSQLForEnums(userDefinedEnumType: UserDefinedEnumTypes): string {
        const labels = userDefinedEnumType.labels.map(label => `'${label}'`).join(', '); // 'label1', 'label2', 'label3'
        return `
            DROP TYPE IF EXISTS ${userDefinedEnumType.typename};
            CREATE TYPE 
                ${userDefinedEnumType.typename} AS ENUM 
            (${labels});`;
    }

    private generateSQLForDropTables(tables: TableMetadataWithData[]): string {
        return tables.map(table => `DROP TABLE IF EXISTS ${table.table_name} CASCADE;`).join('\n');
    }

    private async dropEverything(data: DatabaseType): Promise<void> {
        // Drop all tables
        const dropTablesSQL = this.generateSQLForDropTables(data.tables);
        await this.client.query(dropTablesSQL);
    }

    private async createEnumTypes(userDefinedEnumTypes: UserDefinedEnumTypes[]): Promise<void> {
        await Promise.all(userDefinedEnumTypes.map(async (enumType) => {
            console.log(`Creating type: '${enumType.typename}'`);

            const createEnumSQL = this.generateSQLForEnums(enumType);

            await this.client.query(createEnumSQL);
        }));
    }

    private async createSequences(sequences: Sequences[]): Promise<void> {
        await Promise.all(sequences.map(async (sequence) => {
            console.log(`Creating sequence: '${sequence.sequence_name}'`);

            const createSequenceSQL = `
                    CREATE SEQUENCE IF NOT EXISTS ${sequence.sequence_name}
                        START WITH ${sequence.start_value}
                        MINVALUE ${sequence.minimum_value}
                        MAXVALUE ${sequence.maximum_value}
                        INCREMENT BY ${sequence.increment_by}
                        ${sequence.cycle_option ? 'CYCLE' : 'NO CYCLE'}
                        CACHE 1;
                `;

            // appendFileSync('./test/sequence.sql', createSequenceSQL);

            await this.client.query(createSequenceSQL);
        }));
    }

    private async createTables(tables: TableMetadataWithData[]): Promise<void> {
        await Promise.all(tables.map(async (table) => {
            console.log(`Creating table: '${table.table_name}'`);

            const createTableSQL = this.generateSQLForCreatingTables(table.table_name, table.columns);

            await this.client.query(createTableSQL);

            const insertDataSQL = this.generateSQLForInsertingData(table);

            await this.client.query(insertDataSQL);
        }));
    }

    private async createIndexes(indexes: IndexType[]): Promise<void> {
        await Promise.all(indexes.map(async (index) => {
            console.log(`Creating index: '${index.index_name}'`);

            const createIndexSQL = this.generateSQLForCreatingIndexes(index);

            await this.client.query(createIndexSQL);
        }));
    }

    private async createViews(views: ViewType[]): Promise<void> {
        await Promise.all(views.map(async (view) => {
            console.log(`Creating view: '${view.name}'`);

            const createViewSQL = this.generateSQLForCreatingViews(view);

            await this.client.query(createViewSQL);
        }));
    }

    async getData(tableName: string | null): Promise<DatabaseType> {
        try {
            await this.client.query(`BEGIN`);

            console.log(`Getting metadata from database: '${this.db}'`);

            // const { rows: tableMetadata } = await this.client.query(`
            //     SELECT 
            //         table_name,
            //         json_agg(
            //             json_build_object(
            //                 'column_name', column_name,
            //                 'data_type', udt_name,
            //                 'character_maximum_length', character_maximum_length,
            //                 'is_nullable', is_nullable,
            //                 'column_default', column_default
            //             )
            //             ORDER BY ordinal_position
            //         ) as columns
            //     FROM 
            //         information_schema.columns
            //     WHERE
            //         table_schema = $1 AND
            //         ($2::text IS NULL OR table_name = $2)
            //     GROUP BY
            //         table_name;
            // `, [this.schema, tableName]);

            const { rows: tableMetadata } = await this.client.query(`
                WITH 
                primary_key_columns AS (
                    SELECT 
                        tc.table_name, 
                        kcu.column_name as pk_column
                    FROM 
                        information_schema.table_constraints tc
                    JOIN 
                        information_schema.key_column_usage kcu 
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    WHERE 
                        tc.constraint_type = 'PRIMARY KEY'
                        AND tc.table_schema = $1
                ),
                foreign_key_columns AS (
                    SELECT 
                        tc.table_name, 
                        kcu.column_name as fk_column,
                        json_build_object(
                            'table_name', ccu.table_name,
                            'column_name', ccu.column_name
                        ) as foreign_key_info
                    FROM 
                        information_schema.table_constraints tc
                    JOIN 
                        information_schema.key_column_usage kcu 
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    JOIN 
                        information_schema.constraint_column_usage ccu 
                        ON tc.constraint_name = ccu.constraint_name
                        AND tc.table_schema = ccu.table_schema
                    WHERE 
                        tc.constraint_type = 'FOREIGN KEY'
                        AND tc.table_schema = $1
                ),
                unique_constraint_columns AS (
                    SELECT 
                        tc.table_name, 
                        kcu.column_name as unique_column
                    FROM 
                        information_schema.table_constraints tc
                    JOIN 
                        information_schema.key_column_usage kcu 
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    WHERE 
                        tc.constraint_type = 'UNIQUE'
                        AND tc.table_schema = $1
                )

                SELECT 
                    c.table_name,
                    json_agg(
                        json_build_object(
                            'column_name', c.column_name,
                            'data_type', c.udt_name,
                            'character_maximum_length', c.character_maximum_length,
                            'is_nullable', c.is_nullable,
                            'column_default', c.column_default,
                            'is_primary', COALESCE(pk.pk_column IS NOT NULL, false),
                            'is_foreign', fk.foreign_key_info,
                            'is_unique', COALESCE(uc.unique_column IS NOT NULL, false)
                        )
                        ORDER BY c.ordinal_position
                    ) as columns
                FROM 
                    information_schema.columns c
                LEFT JOIN primary_key_columns pk 
                    ON c.column_name = pk.pk_column AND c.table_name = pk.table_name
                LEFT JOIN foreign_key_columns fk 
                    ON c.column_name = fk.fk_column AND c.table_name = fk.table_name
                LEFT JOIN unique_constraint_columns uc 
                    ON c.column_name = uc.unique_column AND c.table_name = uc.table_name
                WHERE
                    c.table_schema = $1 AND
                    ($2::text IS NULL OR c.table_name = $2)
                GROUP BY
                    c.table_name
                `, [this.schema, tableName]);

            // writeFileSync('./test/metadata.json', JSON.stringify(tableMetadata, null, 2));

            const userDefinedEnumTypes = (await this.client.query(`
                SELECT 
                    t.typname as typename,
                    array_agg(e.enumlabel ORDER BY e.enumsortorder) as labels
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'public'
                GROUP BY t.typname;    
            `)).rows.map((row) => ({
                typename: row.typename,
                labels: row.labels.replace(/{|}/g, '').split(',')
            }));

            const sequences = (await this.client.query(`
                SELECT 
                    sequencename as sequence_name,
                    start_value,
                    min_value as minimum_value,
                    max_value as maximum_value,
                    increment_by,
                    cycle as cycle_option,
                    last_value
                FROM pg_sequences
                WHERE schemaname = $1;
            `, [this.schema])).rows;

            // writeFileSync('./test/sequences.json', JSON.stringify(sequences, null, 2));

            const indexes = (await this.client.query(`
                SELECT 
                    tablename as table_name,
                    indexname as index_name,
                    indexdef as index_def
                FROM 
                    pg_indexes
                WHERE 
                    schemaname = $1
            `, [this.schema])).rows.map(index => {
                const matches = index.index_def.match(/CREATE\s+(UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+(\w+\.)?(\w+)\s+USING\s+(\w+)\s+(.+)$/i);
                return {
                    index_name: matches[2],
                    column_name: matches[6].replace('(', '').replace(')', ''),
                    table_name: matches[4],
                    is_unique: matches[1] ? true : false,
                    index_type: matches[5]
                }
            });

            const views = (await this.client.query(`
                SELECT 
                    viewname as name,
                    definition
                FROM 
                    pg_views
                WHERE 
                    schemaname = $1;
            `, [this.schema])).rows;

            // writeFileSync('./test/indexes.json', JSON.stringify(indexes, null, 2));

            const databaseData = await Promise.all(tableMetadata.map(async (table) => {
                console.log(`Getting data from table: '${table.table_name}'`);

                const { rows: tableData } = await this.client.query(`
                    SELECT 
                        * 
                    FROM 
                        ${this.schema}.${table.table_name};
                `);

                return {
                    ...table,
                    columns: table.columns.map((column: ColumnType) => ({
                        ...column,
                        data_type: this.getSQLType(column)
                    })),
                    data: tableData
                }
            }));

            await this.client.query(`COMMIT`);

            const finalData: DatabaseType = {
                name: this.db,
                userDefinedEnumTypes: userDefinedEnumTypes,
                sequences: sequences,
                indexes: indexes,
                views: views,
                tables: databaseData
            };

            writeFileSync('./test/data.json', JSON.stringify(databaseData, null, 2));

            console.log(`Successfully retrieved data from database: '${this.db}'`);
            return finalData
        } catch (error) {
            await this.client.query(`ROLLBACK`);
            console.error(error);

            throw new Error(`Error retrieving data: ${error}`);
        }
    }

    async insertData(data: DatabaseType): Promise<void> {
        try {
            console.log(`Inserting data into database: '${this.db}'`);

            await this.client.query(`BEGIN`);

            await this.dropEverything(data);

            await this.createEnumTypes(data.userDefinedEnumTypes);
            await this.createSequences(data.sequences);
            await this.createTables(data.tables);
            await this.createIndexes(data.indexes);
            await this.createViews(data.views);

            await this.client.query(`COMMIT`);

            console.log(`Successfully inserted data into database: '${this.db}'`);
        } catch (error) {
            await this.client.query(`ROLLBACK`);

            throw new Error(`Error inserting data: ${error}`);
        }
    }
}