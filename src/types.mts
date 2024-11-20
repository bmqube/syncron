export interface DatabaseAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getData(tableName: string | null): Promise<DatabaseType>;
    insertData(data: DatabaseType): Promise<void>;
}

export type TableMetadataWithData = {
    table_name: string;
    columns: ColumnType[];
    data: {
        [key: string]: unknown;
    }[];
}

export type DatabaseType = {
    name: string;
    userDefinedEnumTypes: UserDefinedEnumTypes[];
    sequences: Sequences[];
    tables: TableMetadataWithData[];
}

export type ColumnType = {
    column_name: string;
    data_type: string;
    character_maximum_length: number;
    is_nullable: 'YES' | 'NO';
    column_default: string;
}

export type Sequences = {
    sequence_name: string,
    start_value: string,
    minimum_value: string,
    maximum_value: string,
    increment_by: string,
    cycle_option: boolean,
    data_type: string,
    last_value: string
}

export type UserDefinedEnumTypes = {
    typename: string;
    labels: string[];
}