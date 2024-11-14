export interface DatabaseAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getData(): Promise<TableMetadataWithData[]>;
    insertData(data: TableMetadataWithData[]): Promise<void>;
}

export type TableMetadataWithData = {
    table_name: string;
    columns: {
        column_name: string;
        data_type: string;
        character_maximum_length: number;
    }[];
    data: {
        [key: string]: unknown;
    }[];
}