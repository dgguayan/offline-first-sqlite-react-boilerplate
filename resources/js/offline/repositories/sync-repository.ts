import type { LocalDatabase } from '@/offline/database/database';
import type { SqlStatement } from '@/offline/database/messages';
import type { Project } from '@/offline/types/project';
import type {
    OutboxMutation,
    ServerEntityRecord,
    SyncChange,
    SyncConflict,
    SyncEntityType,
    SyncOperation,
    SyncSummary,
} from '@/offline/types/sync';
import type { Task } from '@/offline/types/task';

type OutboxRow = {
    id: string;
    entity_type: SyncEntityType;
    entity_id: string;
    operation: SyncOperation;
    payload: string;
    base_version: number | null;
    attempts: number;
};

type ConflictRow = {
    entity_type: SyncEntityType;
    entity_id: string;
    local_record: string;
    server_record: string;
    server_version: number;
    created_at: string;
};

type EntityRow = {
    id: string;
    title: string;
    completed: number;
    created_at: string;
    updated_at: string;
    version: number;
    sync_status: Task['syncStatus'];
    deleted_at: string | null;
};

type SummaryRow = {
    pending_count: number;
    conflict_count: number;
    rejected_count: number;
};

type LocalEntity = Task | Project;

export class SqliteSyncRepository {
    public constructor(
        private readonly database: LocalDatabase,
        private readonly notifyDataChanged: () => void = () => undefined,
    ) {}

    public async recoverInterruptedMutations(): Promise<void> {
        await this.database.execute(`
            UPDATE sync_outbox
            SET claim_token = NULL
            WHERE state = 'in_flight'
        `);
    }

    public async claimPending(
        now: string,
        limit = 25,
    ): Promise<OutboxMutation[]> {
        const claimToken = crypto.randomUUID();
        const rows = await this.database.transaction<OutboxRow>(
            [
                {
                    sql: `
                        UPDATE sync_outbox
                        SET state = 'in_flight',
                            claim_token = ?,
                            last_attempt_at = ?,
                            updated_at = ?
                        WHERE rowid IN (
                            SELECT candidate.rowid
                            FROM sync_outbox AS candidate
                            WHERE (
                                    candidate.state = 'pending'
                                    OR (
                                        candidate.state = 'in_flight'
                                        AND candidate.claim_token IS NULL
                                    )
                                )
                                AND (
                                    candidate.next_retry_at IS NULL
                                    OR candidate.next_retry_at <= ?
                                )
                                AND NOT EXISTS (
                                    SELECT 1
                                    FROM sync_outbox AS predecessor
                                    WHERE predecessor.entity_type =
                                            candidate.entity_type
                                        AND predecessor.entity_id =
                                            candidate.entity_id
                                        AND predecessor.rowid < candidate.rowid
                                        AND predecessor.state IN (
                                            'pending', 'in_flight'
                                        )
                                )
                            ORDER BY candidate.rowid
                            LIMIT ?
                        )
                    `,
                    parameters: [claimToken, now, now, now, limit],
                },
            ],
            {
                sql: `
                    SELECT
                        id,
                        entity_type,
                        entity_id,
                        operation,
                        payload,
                        base_version,
                        attempts
                    FROM sync_outbox
                    WHERE claim_token = ?
                    ORDER BY rowid
                `,
                parameters: [claimToken],
            },
        );

        return rows.map(mapOutboxRow);
    }

    public async markAccepted(
        mutation: OutboxMutation,
        serverRecord: ServerEntityRecord,
    ): Promise<void> {
        const now = new Date().toISOString();

        await this.database.transaction([
            {
                sql: 'DELETE FROM sync_outbox WHERE id = ?',
                parameters: [mutation.id],
            },
            {
                sql: `
                    UPDATE sync_outbox
                    SET base_version = ?, updated_at = ?
                    WHERE entity_type = ?
                        AND entity_id = ?
                        AND state IN ('pending', 'in_flight')
                `,
                parameters: [
                    serverRecord.version,
                    now,
                    mutation.entityType,
                    mutation.entityId,
                ],
            },
            acceptedEntityStatement(mutation, serverRecord),
        ]);

        this.notifyDataChanged();
    }

    public async markConflict(
        mutation: OutboxMutation,
        serverRecord: ServerEntityRecord,
    ): Promise<void> {
        const entity = await this.findEntityIncludingDeleted(
            mutation.entityType,
            mutation.entityId,
        );

        if (!entity) {
            return;
        }

        const now = new Date().toISOString();
        const config = entityConfig(mutation.entityType);

        await this.database.transaction([
            {
                sql: `
                    UPDATE sync_outbox
                    SET state = 'conflict',
                        claim_token = NULL,
                        updated_at = ?
                    WHERE entity_type = ? AND entity_id = ?
                `,
                parameters: [now, mutation.entityType, mutation.entityId],
            },
            {
                sql: `
                    UPDATE ${config.table}
                    SET sync_status = 'conflict'
                    WHERE id = ?
                `,
                parameters: [mutation.entityId],
            },
            upsertConflictStatement(
                mutation.entityType,
                mutation.entityId,
                mutation.id,
                toServerRecord(entity),
                serverRecord,
                now,
            ),
        ]);

        this.notifyDataChanged();
    }

    public async markRejected(
        mutation: OutboxMutation,
        message: string,
    ): Promise<void> {
        const now = new Date().toISOString();
        const config = entityConfig(mutation.entityType);

        await this.database.transaction([
            {
                sql: `
                    UPDATE sync_outbox
                    SET state = 'rejected',
                        claim_token = NULL,
                        last_error = ?,
                        updated_at = ?
                    WHERE entity_type = ? AND entity_id = ?
                `,
                parameters: [
                    message,
                    now,
                    mutation.entityType,
                    mutation.entityId,
                ],
            },
            {
                sql: `
                    UPDATE ${config.table}
                    SET sync_status = 'error'
                    WHERE id = ?
                `,
                parameters: [mutation.entityId],
            },
        ]);

        this.notifyDataChanged();
    }

    public async markRetry(
        mutation: OutboxMutation,
        message: string,
        nextRetryAt: string,
    ): Promise<void> {
        await this.database.execute(
            `
                UPDATE sync_outbox
                SET state = 'in_flight',
                    claim_token = NULL,
                    attempts = attempts + 1,
                    next_retry_at = ?,
                    last_error = ?,
                    updated_at = ?
                WHERE id = ?
            `,
            [nextRetryAt, message, new Date().toISOString(), mutation.id],
        );
    }

    public async applyPullBatch(
        changes: readonly SyncChange[],
        nextCursor: number,
    ): Promise<void> {
        const statements: SqlStatement[] = [];

        for (const change of changes) {
            statements.push(...pullChangeStatements(change));
        }

        statements.push({
            sql: `
                UPDATE sync_metadata
                SET value = ?, updated_at = ?
                WHERE key = 'pull_cursor'
            `,
            parameters: [String(nextCursor), new Date().toISOString()],
        });

        await this.database.transaction(statements);
        this.notifyDataChanged();
    }

    public async cursor(): Promise<number> {
        const rows = await this.database.select<{ value: string }>(`
            SELECT value FROM sync_metadata WHERE key = 'pull_cursor'
        `);

        return Number(rows[0]?.value ?? 0);
    }

    public async summary(): Promise<SyncSummary> {
        const rows = await this.database.select<SummaryRow>(`
            SELECT
                (
                    SELECT COUNT(*) FROM sync_outbox
                    WHERE state IN ('pending', 'in_flight')
                ) AS pending_count,
                (SELECT COUNT(*) FROM sync_conflicts) AS conflict_count,
                (
                    SELECT COUNT(DISTINCT entity_id) FROM sync_outbox
                    WHERE state = 'rejected'
                ) AS rejected_count
        `);
        const row = rows[0];

        return {
            pendingCount: Number(row?.pending_count ?? 0),
            conflictCount: Number(row?.conflict_count ?? 0),
            rejectedCount: Number(row?.rejected_count ?? 0),
        };
    }

    public async conflicts(
        entityType?: SyncEntityType,
    ): Promise<SyncConflict[]> {
        const rows = await this.database.select<ConflictRow>(
            `
                SELECT
                    entity_type,
                    entity_id,
                    local_record,
                    server_record,
                    server_version,
                    created_at
                FROM sync_conflicts
                ${entityType ? 'WHERE entity_type = ?' : ''}
                ORDER BY created_at DESC
            `,
            entityType ? [entityType] : undefined,
        );

        return rows.map((row) => ({
            entityType: row.entity_type,
            entityId: row.entity_id,
            localRecord: JSON.parse(row.local_record) as ServerEntityRecord,
            serverRecord: JSON.parse(row.server_record) as ServerEntityRecord,
            serverVersion: row.server_version,
            createdAt: row.created_at,
        }));
    }

    public async useServerVersion(
        entityType: SyncEntityType,
        entityId: string,
    ): Promise<void> {
        const conflict = (await this.conflicts(entityType)).find(
            (candidate) => candidate.entityId === entityId,
        );

        if (!conflict) {
            throw new Error('The sync conflict was not found.');
        }

        await this.database.transaction([
            {
                sql: `
                    DELETE FROM sync_outbox
                    WHERE entity_type = ? AND entity_id = ?
                `,
                parameters: [entityType, entityId],
            },
            {
                sql: `
                    DELETE FROM sync_conflicts
                    WHERE entity_type = ? AND entity_id = ?
                `,
                parameters: [entityType, entityId],
            },
            upsertServerEntityStatement(entityType, conflict.serverRecord),
        ]);

        this.notifyDataChanged();
    }

    public async keepLocalVersion(
        entityType: SyncEntityType,
        entityId: string,
    ): Promise<void> {
        const [entity, conflict] = await Promise.all([
            this.findEntityIncludingDeleted(entityType, entityId),
            this.conflicts(entityType).then((conflicts) =>
                conflicts.find((candidate) => candidate.entityId === entityId),
            ),
        ]);

        if (!entity || !conflict) {
            throw new Error('The sync conflict was not found.');
        }

        const now = new Date().toISOString();
        const operation: SyncOperation = entity.deletedAt ? 'delete' : 'update';
        const localRecord = toServerRecord(entity);
        const config = entityConfig(entityType);

        await this.database.transaction([
            {
                sql: `
                    DELETE FROM sync_outbox
                    WHERE entity_type = ? AND entity_id = ?
                `,
                parameters: [entityType, entityId],
            },
            {
                sql: `
                    DELETE FROM sync_conflicts
                    WHERE entity_type = ? AND entity_id = ?
                `,
                parameters: [entityType, entityId],
            },
            {
                sql: `
                    UPDATE ${config.table}
                    SET version = ?, sync_status = 'pending'
                    WHERE id = ?
                `,
                parameters: [conflict.serverVersion, entityId],
            },
            {
                sql: `
                    INSERT INTO sync_outbox (
                        id, entity_type, entity_id, operation, payload,
                        base_version, state, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                `,
                parameters: [
                    crypto.randomUUID(),
                    entityType,
                    entityId,
                    operation,
                    JSON.stringify(withoutVersion(localRecord)),
                    conflict.serverVersion,
                    now,
                    now,
                ],
            },
        ]);

        this.notifyDataChanged();
    }

    private async findEntityIncludingDeleted(
        entityType: SyncEntityType,
        id: string,
    ): Promise<LocalEntity | null> {
        const config = entityConfig(entityType);
        const rows = await this.database.select<EntityRow>(
            `
                SELECT
                    id, title, completed, created_at, updated_at,
                    version, sync_status, deleted_at
                FROM ${config.table}
                WHERE id = ?
                LIMIT 1
            `,
            [id],
        );
        const row = rows[0];

        return row
            ? {
                  id: row.id,
                  title: row.title,
                  completed: row.completed === 1,
                  createdAt: row.created_at,
                  updatedAt: row.updated_at,
                  version: row.version,
                  syncStatus: row.sync_status,
                  deletedAt: row.deleted_at,
              }
            : null;
    }
}

function mapOutboxRow(row: OutboxRow): OutboxMutation {
    return {
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        operation: row.operation,
        payload: JSON.parse(row.payload) as OutboxMutation['payload'],
        baseVersion: row.base_version,
        attempts: row.attempts,
    };
}

function pullChangeStatements(change: SyncChange): SqlStatement[] {
    const record = change.record;
    const serverRecord = JSON.stringify(record);
    const config = entityConfig(change.entity_type);

    return [
        {
            sql: `
                INSERT INTO sync_conflicts (
                    entity_type, entity_id, mutation_id, local_record,
                    server_record, server_version, created_at
                )
                SELECT
                    '${config.entityType}',
                    ${config.table}.id,
                    (
                        SELECT id FROM sync_outbox
                        WHERE entity_type = '${config.entityType}'
                            AND entity_id = ${config.table}.id
                        ORDER BY rowid
                        LIMIT 1
                    ),
                    json_object(
                        'id', ${config.table}.id,
                        'title', ${config.table}.title,
                        'completed', json(${config.table}.completed),
                        'version', ${config.table}.version,
                        'created_at', ${config.table}.created_at,
                        'updated_at', ${config.table}.updated_at,
                        'deleted_at', ${config.table}.deleted_at
                    ),
                    ?,
                    ?,
                    ?
                FROM ${config.table}
                WHERE ${config.table}.id = ?
                    AND ${config.table}.version < ?
                    AND EXISTS (
                        SELECT 1 FROM sync_outbox
                        WHERE entity_type = '${config.entityType}'
                            AND entity_id = ${config.table}.id
                    )
                ON CONFLICT (entity_type, entity_id) DO UPDATE SET
                    server_record = excluded.server_record,
                    server_version = excluded.server_version,
                    created_at = excluded.created_at
            `,
            parameters: [
                serverRecord,
                record.version,
                new Date().toISOString(),
                record.id,
                record.version,
            ],
        },
        {
            sql: `
                UPDATE ${config.table}
                SET sync_status = 'conflict'
                WHERE id = ?
                    AND version < ?
                    AND EXISTS (
                        SELECT 1 FROM sync_outbox
                        WHERE entity_type = '${config.entityType}'
                            AND entity_id = ${config.table}.id
                    )
            `,
            parameters: [record.id, record.version],
        },
        upsertServerEntityStatement(change.entity_type, record, true),
    ];
}

function acceptedEntityStatement(
    mutation: OutboxMutation,
    record: ServerEntityRecord,
): SqlStatement {
    const config = entityConfig(mutation.entityType);

    return {
        sql: `
            UPDATE ${config.table}
            SET title = CASE
                    WHEN NOT EXISTS (
                        SELECT 1 FROM sync_outbox
                        WHERE entity_type = '${config.entityType}'
                            AND entity_id = ${config.table}.id
                            AND state IN ('pending', 'in_flight')
                    ) THEN ? ELSE title
                END,
                completed = CASE
                    WHEN NOT EXISTS (
                        SELECT 1 FROM sync_outbox
                        WHERE entity_type = '${config.entityType}'
                            AND entity_id = ${config.table}.id
                            AND state IN ('pending', 'in_flight')
                    ) THEN ? ELSE completed
                END,
                created_at = ?,
                updated_at = CASE
                    WHEN NOT EXISTS (
                        SELECT 1 FROM sync_outbox
                        WHERE entity_type = '${config.entityType}'
                            AND entity_id = ${config.table}.id
                            AND state IN ('pending', 'in_flight')
                    ) THEN ? ELSE updated_at
                END,
                deleted_at = CASE
                    WHEN NOT EXISTS (
                        SELECT 1 FROM sync_outbox
                        WHERE entity_type = '${config.entityType}'
                            AND entity_id = ${config.table}.id
                            AND state IN ('pending', 'in_flight')
                    ) THEN ? ELSE deleted_at
                END,
                version = ?,
                sync_status = CASE
                    WHEN EXISTS (
                        SELECT 1 FROM sync_outbox
                        WHERE entity_type = '${config.entityType}'
                            AND entity_id = ${config.table}.id
                            AND state IN ('pending', 'in_flight')
                    ) THEN 'pending' ELSE 'synced'
                END
            WHERE id = ?
        `,
        parameters: [
            record.title,
            record.completed ? 1 : 0,
            record.created_at,
            record.updated_at,
            record.deleted_at,
            record.version,
            mutation.entityId,
        ],
    };
}

function upsertServerEntityStatement(
    entityType: SyncEntityType,
    record: ServerEntityRecord,
    protectUnsynced = false,
): SqlStatement {
    const config = entityConfig(entityType);

    return {
        sql: `
            INSERT INTO ${config.table} (
                id, title, completed, created_at, updated_at,
                version, sync_status, deleted_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'synced', ?)
            ON CONFLICT (id) DO UPDATE SET
                title = excluded.title,
                completed = excluded.completed,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at,
                version = excluded.version,
                sync_status = 'synced',
                deleted_at = excluded.deleted_at
            ${
                protectUnsynced
                    ? `WHERE excluded.version > ${config.table}.version
                        AND NOT EXISTS (
                        SELECT 1 FROM sync_outbox
                        WHERE entity_type = '${config.entityType}'
                            AND entity_id = ?
                    )`
                    : ''
            }
        `,
        parameters: [
            record.id,
            record.title,
            record.completed ? 1 : 0,
            record.created_at,
            record.updated_at,
            record.version,
            record.deleted_at,
            ...(protectUnsynced ? [record.id] : []),
        ],
    };
}

function upsertConflictStatement(
    entityType: SyncEntityType,
    entityId: string,
    mutationId: string,
    localRecord: ServerEntityRecord,
    serverRecord: ServerEntityRecord,
    now: string,
): SqlStatement {
    return {
        sql: `
            INSERT INTO sync_conflicts (
                entity_type, entity_id, mutation_id, local_record,
                server_record, server_version, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (entity_type, entity_id) DO UPDATE SET
                mutation_id = excluded.mutation_id,
                local_record = excluded.local_record,
                server_record = excluded.server_record,
                server_version = excluded.server_version,
                created_at = excluded.created_at
        `,
        parameters: [
            entityType,
            entityId,
            mutationId,
            JSON.stringify(localRecord),
            JSON.stringify(serverRecord),
            serverRecord.version,
            now,
        ],
    };
}

function toServerRecord(entity: LocalEntity): ServerEntityRecord {
    return {
        id: entity.id,
        title: entity.title,
        completed: entity.completed,
        version: entity.version,
        created_at: entity.createdAt,
        updated_at: entity.updatedAt,
        deleted_at: entity.deletedAt,
    };
}

function withoutVersion(
    record: ServerEntityRecord,
): Omit<ServerEntityRecord, 'version'> {
    return {
        id: record.id,
        title: record.title,
        completed: record.completed,
        created_at: record.created_at,
        updated_at: record.updated_at,
        deleted_at: record.deleted_at,
    };
}

function entityConfig(entityType: SyncEntityType): {
    entityType: SyncEntityType;
    table: 'tasks' | 'projects';
} {
    return entityType === 'task'
        ? { entityType, table: 'tasks' }
        : { entityType, table: 'projects' };
}
