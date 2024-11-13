import { DatabaseAdapter } from '../../types.mjs';
import pg from 'pg';
import type { Client as ClientType } from 'pg';

const { Client } = pg;

export class PostgresAdapter implements DatabaseAdapter {
    private client: ClientType;
    private uri: string;
    private db: string;

    constructor(uri: string) {
        this.uri = uri;
        this.client = new Client(uri);
        this.db = uri.split('/').pop()!!;
    }

    async connect(): Promise<void> {
        await this.client.connect();
    }

    async disconnect(): Promise<void> {
        await this.client.end();
    }

    async getData(): Promise<unknown[]> {
        const { rows: databaseModels } = await this.client.query(`
            SELECT 
                information_schema.tables.table_name,
                array_agg(json_build_object(
                    'column_name', column_name,
                    'data_type', data_type,
                    'character_maximum_length', character_maximum_length
                )) as columns
            FROM 
                information_schema.tables
            LEFT JOIN
                information_schema.columns
            ON  
                information_schema.tables.table_name = information_schema.columns.table_name
            WHERE 
                information_schema.tables.table_schema = 'public' AND 
                information_schema.tables.table_type = 'BASE TABLE'
            GROUP BY
                information_schema.tables.table_name;
        `);

        console.log(JSON.stringify(databaseModels, null, 2));

        return [];
    }

    async insertData(data: unknown[]): Promise<void> {
        // Implement data insertion logic
    }
}