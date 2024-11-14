import type { Client as ClientType } from 'pg';
import pg from 'pg';
import { DatabaseAdapter, TableMetadataWithData } from '../../types.mjs';

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

    async getData(): Promise<TableMetadataWithData[]> {
        try {
            await this.client.query(`BEGIN`);

            console.log(`Getting metadata from database: '${this.db}'`);

            const { rows: tableMetadata } = await this.client.query(`
                SELECT 
                    table_name,
                    json_agg(json_build_object(
                        'column_name', column_name,
                        'data_type', data_type,
                        'character_maximum_length', character_maximum_length
                    )) as columns
                FROM 
                    information_schema.columns
                WHERE
                    table_schema = $1
                GROUP BY
                    table_name;
            `, [this.schema]);

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
            // console.log(JSON.stringify(databaseData, null, 2));

            console.log(`Successfully retrieved data from database: '${this.db}'`);
            return databaseData;
        } catch (error) {
            await this.client.query(`ROLLBACK`);
            console.error(error);

            throw new Error(`Error retrieving data: ${error}`);
        }
    }

    async insertData(data: TableMetadataWithData[]): Promise<void> {
    }
}