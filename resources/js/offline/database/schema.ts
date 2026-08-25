export type LocalMigration = {
    version: number;
    statements: readonly string[];
};

export const createMigrationsTableSql = `
    CREATE TABLE IF NOT EXISTS local_schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
    )
`;

export const localMigrations: readonly LocalMigration[] = [
    {
        version: 1,
        statements: [
            `
                CREATE TABLE tasks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0
                        CHECK (completed IN (0, 1)),
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            `,
            `
                CREATE INDEX tasks_updated_at_index
                ON tasks (updated_at DESC)
            `,
        ],
    },
];
