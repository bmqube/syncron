import { DatabaseAdapter } from '../types.mjs';
import { PostgresAdapter } from './postgres/index.mjs';

export function createAdapter(uri: string): DatabaseAdapter {
    if (uri.startsWith('postgres://')) {
        return new PostgresAdapter(uri);
    }

    throw new Error(`Unsupported database type: ${uri}`);
}
