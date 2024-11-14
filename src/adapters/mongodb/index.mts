import { MongoClient } from 'mongodb';
import { DatabaseAdapter, TableMetadataWithData } from '../../types.mjs';

export class MongoDBAdapter implements DatabaseAdapter {
    private client: MongoClient;
    private uri: string;
    private db: string;
    private schema: string;

    constructor(uri: string, schema?: string) {
        this.uri = uri;
        this.client = new MongoClient(uri);
        this.db = uri.split('/').pop()!!;
        this.schema = schema || 'public';
    }

    async connect(): Promise<void> {
        await this.client.connect();
    }

    async disconnect(): Promise<void> {
        await this.client.close();
    }

    async getData(): Promise<TableMetadataWithData[]> {
        return [];
    }

    async insertData(data: TableMetadataWithData[]): Promise<void> {
        try {

            const db = this.client.db(this.db);

            console.log(`Inserting data into database: '${this.db}'`);


            await Promise.all(data.map(async (table) => {
                console.log(`Inserting data into collection: '${table.table_name}'`);

                const collection = db.collection(table.table_name);

                await collection.insertMany(table.data);
            }));

            console.log(`Data inserted successfully`);
        } catch (error) {
            throw new Error(`Error inserting data: ${error}`);
        }
    }
}