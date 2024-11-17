import type { Client as ClientType } from 'pg';
import pg from 'pg';
import { ColumnType, DatabaseAdapter, TableMetadataWithData } from '../../types.mjs';
import { writeFileSync } from 'fs';

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

    private async truncateTables(): Promise<void> {
        await this.client.query(`
            DO $$
            DECLARE
                table_name TEXT;
            BEGIN
                FOR table_name IN
                    SELECT tablename
                    FROM pg_tables
                    WHERE schemaname = 'public'
                LOOP
                    EXECUTE format('TRUNCATE TABLE %I CASCADE;', table_name);
                END LOOP;
            END $$;
        `)
    };

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
                        return `'${JSON.stringify(value)}'::${data_type}`;
                    }

                    return `'${JSON.stringify(value)}'::${data_type}`;
                }

                if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;

                return value;
            });
            return `(${rowValues.join(', ')})`;
        }).join(',\n');

        return `INSERT INTO ${tableName} (${columnNames}) VALUES\n${values};\n\n`;
    }

    private generateSQLForCreatingTables(tableName: string, data: ColumnType[]): string {
        const columns = data.map(col => {
            return `  ${col.column_name} ${col.data_type}`;
        }).join(',\n');

        return `CREATE TABLE IF NOT EXISTS ${tableName} (\n${columns}\n);\n\n`;
    }

    async getData(tableName: string | null): Promise<TableMetadataWithData[]> {
        try {
            await this.client.query(`BEGIN`);

            console.log(`Getting metadata from database: '${this.db}'`);

            const { rows: tableMetadata } = await this.client.query(`
                SELECT 
                    table_name,
                    json_agg(json_build_object(
                        'column_name', column_name,
                        'data_type', udt_name,
                        'character_maximum_length', character_maximum_length
                    )) as columns
                FROM 
                    information_schema.columns
                WHERE
                    table_schema = $1 AND
                    table_name = COALESCE($2, table_name)
                GROUP BY
                    table_name;
            `, [this.schema, tableName]);

            tableMetadata.map((table) => {
                table.columns.map((column: ColumnType) => ({
                    ...column,
                    data_type: this.getSQLType(column)
                }));
            });

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
                    data: tableData
                }
            }));

            await this.client.query(`COMMIT`);

            writeFileSync('./test/data.json', JSON.stringify(databaseData, null, 2));

            console.log(`Successfully retrieved data from database: '${this.db}'`);
            return databaseData;
        } catch (error) {
            await this.client.query(`ROLLBACK`);
            console.error(error);

            throw new Error(`Error retrieving data: ${error}`);
        }
    }

    async insertData(data: TableMetadataWithData[]): Promise<void> {
        try {
            console.log(`Inserting data into database: '${this.db}'`);

            await this.truncateTables();

            await this.client.query(`BEGIN`);

            await Promise.all(data.map(async (table) => {
                console.log(`Creating table: '${table.table_name}'`);

                const createTableSQL = this.generateSQLForCreatingTables(table.table_name, table.columns);

                await this.client.query(createTableSQL);

                console.log(`Inserting data into table: '${table.table_name}'`);

                const insertDataSQL = this.generateSQLForInsertingData(table);

                await this.client.query(insertDataSQL);
            }));

            await this.client.query(`COMMIT`);

            console.log(`Successfully inserted data into database: '${this.db}'`);
        } catch (error) {
            await this.client.query(`ROLLBACK`);

            throw new Error(`Error inserting data: ${error}`);
        }
    }
}