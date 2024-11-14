import { DatabaseAdapter } from '../types.mjs';
import { MongoDBAdapter } from './mongodb/index.mjs';
import { PostgresAdapter } from './postgres/index.mjs';

export function createAdapter(uri: string): DatabaseAdapter {
    if (uri.startsWith('postgres://') || uri.startsWith('postgresql://')) {
        return new PostgresAdapter(uri);
    }

    if (uri.startsWith('mongodb://')) {
        return new MongoDBAdapter(uri);
    }

    throw new Error(`Unsupported database type: ${uri}`);
}
