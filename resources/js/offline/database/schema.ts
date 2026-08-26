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
    {
        version: 2,
        statements: [
            `
                ALTER TABLE tasks
                ADD COLUMN version INTEGER NOT NULL DEFAULT 0
                    CHECK (version >= 0)
            `,
            `
                ALTER TABLE tasks
                ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (sync_status IN (
                        'pending', 'synced', 'conflict', 'error'
                    ))
            `,
            `
                ALTER TABLE tasks
                ADD COLUMN deleted_at TEXT NULL
            `,
            `
                CREATE TABLE sync_outbox (
                    id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL
                        CHECK (entity_type = 'task'),
                    entity_id TEXT NOT NULL,
                    operation TEXT NOT NULL
                        CHECK (operation IN ('create', 'update', 'delete')),
                    payload TEXT NOT NULL,
                    base_version INTEGER NULL
                        CHECK (base_version IS NULL OR base_version >= 0),
                    state TEXT NOT NULL DEFAULT 'pending'
                        CHECK (state IN (
                            'pending', 'in_flight', 'conflict', 'rejected'
                        )),
                    claim_token TEXT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0
                        CHECK (attempts >= 0),
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_attempt_at TEXT NULL,
                    next_retry_at TEXT NULL,
                    last_error TEXT NULL,
                    FOREIGN KEY (entity_id) REFERENCES tasks (id)
                        ON DELETE CASCADE
                )
            `,
            `
                CREATE UNIQUE INDEX sync_outbox_pending_entity_unique
                ON sync_outbox (entity_type, entity_id)
                WHERE state = 'pending'
            `,
            `
                CREATE INDEX sync_outbox_claim_index
                ON sync_outbox (state, next_retry_at, created_at)
            `,
            `
                CREATE TABLE sync_metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            `,
            `
                INSERT INTO sync_metadata (key, value, updated_at)
                VALUES ('pull_cursor', '0', CURRENT_TIMESTAMP)
            `,
            `
                CREATE TABLE sync_conflicts (
                    entity_type TEXT NOT NULL
                        CHECK (entity_type = 'task'),
                    entity_id TEXT NOT NULL,
                    mutation_id TEXT NULL,
                    local_record TEXT NOT NULL,
                    server_record TEXT NULL,
                    server_version INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (entity_type, entity_id),
                    FOREIGN KEY (entity_id) REFERENCES tasks (id)
                        ON DELETE CASCADE
                )
            `,
            `
                INSERT INTO sync_outbox (
                    id,
                    entity_type,
                    entity_id,
                    operation,
                    payload,
                    base_version,
                    state,
                    created_at,
                    updated_at
                )
                SELECT
                    lower(hex(randomblob(4))) || '-' ||
                    lower(hex(randomblob(2))) || '-4' ||
                    substr(lower(hex(randomblob(2))), 2) || '-' ||
                    substr('89ab', (random() & 3) + 1, 1) ||
                    substr(lower(hex(randomblob(2))), 2) || '-' ||
                    lower(hex(randomblob(6))),
                    'task',
                    id,
                    'create',
                    json_object(
                        'id', id,
                        'title', title,
                        'completed', json(completed),
                        'created_at', created_at,
                        'updated_at', updated_at,
                        'deleted_at', NULL
                    ),
                    NULL,
                    'pending',
                    updated_at,
                    updated_at
                FROM tasks
            `,
        ],
    },
    {
        version: 3,
        statements: [
            `
                CREATE TABLE projects (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0
                        CHECK (completed IN (0, 1)),
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0
                        CHECK (version >= 0),
                    sync_status TEXT NOT NULL DEFAULT 'pending'
                        CHECK (sync_status IN (
                            'pending', 'synced', 'conflict', 'error'
                        )),
                    deleted_at TEXT NULL
                )
            `,
            `
                CREATE INDEX projects_updated_at_index
                ON projects (updated_at DESC)
            `,
            `
                CREATE TABLE sync_outbox_v3 (
                    id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL
                        CHECK (entity_type IN ('task', 'project')),
                    entity_id TEXT NOT NULL,
                    operation TEXT NOT NULL
                        CHECK (operation IN ('create', 'update', 'delete')),
                    payload TEXT NOT NULL,
                    base_version INTEGER NULL
                        CHECK (base_version IS NULL OR base_version >= 0),
                    state TEXT NOT NULL DEFAULT 'pending'
                        CHECK (state IN (
                            'pending', 'in_flight', 'conflict', 'rejected'
                        )),
                    claim_token TEXT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0
                        CHECK (attempts >= 0),
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_attempt_at TEXT NULL,
                    next_retry_at TEXT NULL,
                    last_error TEXT NULL
                )
            `,
            `
                INSERT INTO sync_outbox_v3 (
                    id, entity_type, entity_id, operation, payload,
                    base_version, state, claim_token, attempts, created_at,
                    updated_at, last_attempt_at, next_retry_at, last_error
                )
                SELECT
                    id, entity_type, entity_id, operation, payload,
                    base_version, state, claim_token, attempts, created_at,
                    updated_at, last_attempt_at, next_retry_at, last_error
                FROM sync_outbox
            `,
            `DROP TABLE sync_outbox`,
            `ALTER TABLE sync_outbox_v3 RENAME TO sync_outbox`,
            `
                CREATE UNIQUE INDEX sync_outbox_pending_entity_unique
                ON sync_outbox (entity_type, entity_id)
                WHERE state = 'pending'
            `,
            `
                CREATE INDEX sync_outbox_claim_index
                ON sync_outbox (state, next_retry_at, created_at)
            `,
            `
                CREATE TABLE sync_conflicts_v3 (
                    entity_type TEXT NOT NULL
                        CHECK (entity_type IN ('task', 'project')),
                    entity_id TEXT NOT NULL,
                    mutation_id TEXT NULL,
                    local_record TEXT NOT NULL,
                    server_record TEXT NULL,
                    server_version INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (entity_type, entity_id)
                )
            `,
            `
                INSERT INTO sync_conflicts_v3 (
                    entity_type, entity_id, mutation_id, local_record,
                    server_record, server_version, created_at
                )
                SELECT
                    entity_type, entity_id, mutation_id, local_record,
                    server_record, server_version, created_at
                FROM sync_conflicts
            `,
            `DROP TABLE sync_conflicts`,
            `ALTER TABLE sync_conflicts_v3 RENAME TO sync_conflicts`,
        ],
    },
];
