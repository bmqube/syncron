export interface DatabaseAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getData(tableName: string | null): Promise<TableMetadataWithData[]>;
    insertData(data: TableMetadataWithData[]): Promise<void>;
}

export type TableMetadataWithData = {
    table_name: string;
    columns: ColumnType[];
    data: {
        [key: string]: unknown;
    }[];
}

export type ColumnType = {
    column_name: string;
    data_type: string;
    character_maximum_length: number;
}