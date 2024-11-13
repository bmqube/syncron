export interface DatabaseAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getData(): Promise<unknown[]>;
    insertData(data: unknown[]): Promise<void>;
}
