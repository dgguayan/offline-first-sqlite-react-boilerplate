export type SqlParameter = string | number | null | Uint8Array;

export type SqlStatement = {
    sql: string;
    parameters?: readonly SqlParameter[];
};

export type DatabaseStorageInfo = {
    persistence: 'opfs';
    sqliteVersion: string;
};

export type DatabaseWorkerRequest =
    | {
          id: string;
          type: 'initialize';
          userScope: string;
      }
    | {
          id: string;
          type: 'execute';
          statement: SqlStatement;
      }
    | {
          id: string;
          type: 'select';
          statement: SqlStatement;
      }
    | {
          id: string;
          type: 'transaction';
          statements: readonly SqlStatement[];
          resultStatement?: SqlStatement;
      }
    | {
          id: string;
          type: 'close';
      };

export type DatabaseWorkerResponse = {
    id: string;
    value?: unknown;
    error?: {
        name: string;
        message: string;
    };
};
