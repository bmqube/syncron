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
    tables: TableMetadataWithData[];
}

export type ColumnType = {
    column_name: string;
    data_type: string;
    character_maximum_length: number;
    is_nullable: 'YES' | 'NO';
    column_default: string;
}

export type UserDefinedEnumTypes = {
    typename: string;
    labels: string[];
}