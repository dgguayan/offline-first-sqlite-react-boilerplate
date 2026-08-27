import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
    LocalDatabase,
    LocalDatabaseInfo,
} from '@/offline/database/database';
import type { SqlParameter, SqlStatement } from '@/offline/database/messages';
import {
    createMigrationsTableSql,
    localMigrations,
} from '@/offline/database/schema';
import { SqliteProjectRepository } from '@/offline/repositories/project-repository';
import { SqliteSyncRepository } from '@/offline/repositories/sync-repository';
import type { ServerProjectRecord } from '@/offline/types/sync';

type SQLiteDatabase = Awaited<
    ReturnType<typeof sqlite3InitModule>
>['oo1']['DB']['prototype'];

class MemoryDatabase implements LocalDatabase {
    public constructor(private readonly database: SQLiteDatabase) {}

    public async execute(
        sql: string,
        parameters?: readonly SqlParameter[],
    ): Promise<void> {
        this.database.exec({
            sql,
            bind: parameters ? Array.from(parameters) : undefined,
        });
    }

    public async select<Row>(
        sql: string,
        parameters?: readonly SqlParameter[],
    ): Promise<Row[]> {
        return this.database.exec({
            sql,
            bind: parameters ? Array.from(parameters) : undefined,
            rowMode: 'object',
            returnValue: 'resultRows',
        }) as Row[];
    }

    public transaction(statements: readonly SqlStatement[]): Promise<void>;
    public transaction<Row>(
        statements: readonly SqlStatement[],
        resultStatement: SqlStatement,
    ): Promise<Row[]>;
    public async transaction<Row>(
        statements: readonly SqlStatement[],
        resultStatement?: SqlStatement,
    ): Promise<void | Row[]> {
        return this.database.transaction((transaction) => {
            for (const statement of statements) {
                transaction.exec({
                    sql: statement.sql,
                    bind: statement.parameters
                        ? Array.from(statement.parameters)
                        : undefined,
                });
            }

            if (!resultStatement) {
                return undefined;
            }

            return transaction.exec({
                sql: resultStatement.sql,
                bind: resultStatement.parameters
                    ? Array.from(resultStatement.parameters)
                    : undefined,
                rowMode: 'object',
                returnValue: 'resultRows',
            }) as Row[];
        });
    }

    public info(): LocalDatabaseInfo {
        return {
            persistence: 'opfs',
            sqliteVersion: 'test',
            persistentStorageGranted: false,
        };
    }
}

describe('SqliteProjectRepository', () => {
    let sqliteDatabase: SQLiteDatabase;
    let repository: SqliteProjectRepository;
    let syncRepository: SqliteSyncRepository;

    beforeEach(async () => {
        const sqlite3 = await sqlite3InitModule();
        sqliteDatabase = new sqlite3.oo1.DB(':memory:', 'ct');
        sqliteDatabase.exec('PRAGMA foreign_keys = ON');
        sqliteDatabase.exec(createMigrationsTableSql);

        for (const migration of localMigrations) {
            sqliteDatabase.transaction((transaction) => {
                for (const statement of migration.statements) {
                    transaction.exec(statement);
                }

                transaction.exec({
                    sql: `
                        INSERT INTO local_schema_migrations
                            (version, applied_at)
                        VALUES (?, ?)
                    `,
                    bind: [migration.version, new Date().toISOString()],
                });
            });
        }

        const database = new MemoryDatabase(sqliteDatabase);
        repository = new SqliteProjectRepository(database);
        syncRepository = new SqliteSyncRepository(database, () =>
            repository.notifyExternalChange(),
        );
    });

    afterEach(() => {
        sqliteDatabase.close();
    });

    it('creates, reads, updates, and removes a project', async () => {
        const project = await repository.create({
            title: '  First project  ',
        });

        expect(await repository.find(project.id)).toMatchObject({
            title: 'First project',
            completed: false,
            syncStatus: 'pending',
        });

        const updatedProject = await repository.update(project.id, {
            title: 'Finished project',
            completed: true,
        });

        expect(updatedProject).toMatchObject({
            title: 'Finished project',
            completed: true,
        });

        await repository.remove(project.id);

        expect(await repository.find(project.id)).toBeNull();
        expect(
            sqliteDatabase.selectValue(
                'SELECT COUNT(*) FROM sync_outbox WHERE entity_id = ?',
                project.id,
            ),
        ).toBe(0);
    });

    it('validates titles before writing', async () => {
        await expect(repository.create({ title: '   ' })).rejects.toThrow(
            'A project title is required.',
        );
        expect(await repository.all()).toEqual([]);
    });

    it('queues project mutations without affecting task dispatch', async () => {
        const project = await repository.create({ title: 'First draft' });
        await repository.update(project.id, {
            title: 'Final draft',
            completed: true,
        });

        const mutations = await syncRepository.claimPending(
            new Date().toISOString(),
        );

        expect(mutations).toHaveLength(1);
        expect(mutations[0]).toMatchObject({
            entityType: 'project',
            entityId: project.id,
            operation: 'create',
            payload: {
                title: 'Final draft',
                completed: true,
            },
        });
    });

    it('preserves a project conflict until it is resolved', async () => {
        const project = await repository.create({ title: 'Local project' });
        const [createMutation] = await syncRepository.claimPending(
            new Date().toISOString(),
        );
        await syncRepository.markAccepted(
            createMutation,
            serverRecord(project, 1),
        );
        await repository.update(project.id, { title: 'Local edit' });
        const [updateMutation] = await syncRepository.claimPending(
            new Date().toISOString(),
        );
        const remoteRecord = {
            ...serverRecord(project, 2),
            title: 'Server edit',
        };

        await syncRepository.markConflict(updateMutation, remoteRecord);

        expect(await syncRepository.conflicts('project')).toMatchObject([
            {
                entityType: 'project',
                entityId: project.id,
                localRecord: { title: 'Local edit' },
                serverRecord: { title: 'Server edit', version: 2 },
            },
        ]);

        await syncRepository.useServerVersion('project', project.id);

        expect(await repository.find(project.id)).toMatchObject({
            title: 'Server edit',
            version: 2,
            syncStatus: 'synced',
        });
        expect(await syncRepository.conflicts('project')).toEqual([]);
    });

    it('rebases the local project when keeping a conflicting edit', async () => {
        const project = await repository.create({ title: 'Initial project' });
        const [createMutation] = await syncRepository.claimPending(
            new Date().toISOString(),
        );
        await syncRepository.markAccepted(
            createMutation,
            serverRecord(project, 1),
        );
        await repository.update(project.id, { title: 'Keep this edit' });
        const [updateMutation] = await syncRepository.claimPending(
            new Date().toISOString(),
        );
        await syncRepository.markConflict(updateMutation, {
            ...serverRecord(project, 2),
            title: 'Server edit',
        });

        await syncRepository.keepLocalVersion('project', project.id);

        expect(await repository.find(project.id)).toMatchObject({
            title: 'Keep this edit',
            version: 2,
            syncStatus: 'pending',
        });
        expect(await syncRepository.conflicts('project')).toEqual([]);

        const [rebasedMutation] = await syncRepository.claimPending(
            new Date().toISOString(),
        );
        expect(rebasedMutation).toMatchObject({
            entityType: 'project',
            operation: 'update',
            baseVersion: 2,
            payload: { title: 'Keep this edit' },
        });
    });

    it('applies pulled project upserts and tombstones', async () => {
        const projectId = crypto.randomUUID();
        const now = new Date().toISOString();
        const record: ServerProjectRecord = {
            id: projectId,
            title: 'Pulled project',
            completed: false,
            version: 1,
            created_at: now,
            updated_at: now,
            deleted_at: null,
        };

        await syncRepository.applyPullBatch(
            [
                {
                    cursor: 1,
                    entity_type: 'project',
                    entity_id: projectId,
                    operation: 'upsert',
                    version: 1,
                    record,
                },
            ],
            1,
        );

        expect(await repository.find(projectId)).toMatchObject({
            title: 'Pulled project',
            version: 1,
            syncStatus: 'synced',
        });

        await syncRepository.applyPullBatch(
            [
                {
                    cursor: 2,
                    entity_type: 'project',
                    entity_id: projectId,
                    operation: 'delete',
                    version: 2,
                    record: {
                        ...record,
                        version: 2,
                        updated_at: new Date().toISOString(),
                        deleted_at: new Date().toISOString(),
                    },
                },
            ],
            2,
        );

        expect(await repository.find(projectId)).toBeNull();
        expect(await syncRepository.cursor()).toBe(2);

        await syncRepository.applyPullBatch(
            [
                {
                    cursor: 3,
                    entity_type: 'project',
                    entity_id: projectId,
                    operation: 'restore',
                    version: 3,
                    record: {
                        ...record,
                        version: 3,
                        updated_at: new Date().toISOString(),
                        deleted_at: null,
                    },
                },
            ],
            3,
        );

        expect(await repository.find(projectId)).toMatchObject({
            title: 'Pulled project',
            version: 3,
            syncStatus: 'synced',
            deletedAt: null,
        });
        expect(await syncRepository.cursor()).toBe(3);
    });

    it('shows an admin-restored project while preserving a local conflict', async () => {
        const projectId = crypto.randomUUID();
        const now = new Date().toISOString();
        const record: ServerProjectRecord = {
            id: projectId,
            title: 'Project with a local edit',
            completed: false,
            version: 1,
            created_at: now,
            updated_at: now,
            deleted_at: null,
        };

        await syncRepository.applyPullBatch(
            [
                {
                    cursor: 1,
                    entity_type: 'project',
                    entity_id: projectId,
                    operation: 'upsert',
                    version: 1,
                    record,
                },
                {
                    cursor: 2,
                    entity_type: 'project',
                    entity_id: projectId,
                    operation: 'delete',
                    version: 2,
                    record: {
                        ...record,
                        version: 2,
                        updated_at: now,
                        deleted_at: now,
                    },
                },
            ],
            2,
        );
        sqliteDatabase.exec({
            sql: 'UPDATE projects SET title = ? WHERE id = ?',
            bind: ['Unsynced local title', projectId],
        });
        sqliteDatabase.exec({
            sql: `
                INSERT INTO sync_outbox (
                    id, entity_type, entity_id, operation, payload,
                    base_version, state, created_at, updated_at
                ) VALUES (?, 'project', ?, 'update', ?, 2, 'conflict', ?, ?)
            `,
            bind: [
                crypto.randomUUID(),
                projectId,
                JSON.stringify({ title: 'Unsynced local title' }),
                now,
                now,
            ],
        });

        await syncRepository.applyPullBatch(
            [
                {
                    cursor: 3,
                    entity_type: 'project',
                    entity_id: projectId,
                    operation: 'restore',
                    version: 3,
                    record: {
                        ...record,
                        version: 3,
                        updated_at: now,
                        deleted_at: null,
                    },
                },
            ],
            3,
        );

        expect(await repository.find(projectId)).toMatchObject({
            title: 'Unsynced local title',
            version: 2,
            syncStatus: 'conflict',
            deletedAt: null,
        });
        expect(await syncRepository.conflicts('project')).toMatchObject([
            {
                entityId: projectId,
                serverRecord: { version: 3, deleted_at: null },
            },
        ]);
        expect(await syncRepository.cursor()).toBe(3);
    });

    it('repairs an already-consumed restore during the local schema upgrade', async () => {
        const projectId = crypto.randomUUID();
        const now = new Date().toISOString();
        const activeRecord: ServerProjectRecord = {
            id: projectId,
            title: 'Previously restored project',
            completed: false,
            version: 3,
            created_at: now,
            updated_at: now,
            deleted_at: null,
        };

        await syncRepository.applyPullBatch(
            [
                {
                    cursor: 2,
                    entity_type: 'project',
                    entity_id: projectId,
                    operation: 'delete',
                    version: 2,
                    record: {
                        ...activeRecord,
                        version: 2,
                        deleted_at: now,
                    },
                },
            ],
            3,
        );
        sqliteDatabase.exec({
            sql: `
                INSERT INTO sync_conflicts (
                    entity_type, entity_id, mutation_id, local_record,
                    server_record, server_version, created_at
                ) VALUES ('project', ?, NULL, ?, ?, 3, ?)
            `,
            bind: [
                projectId,
                JSON.stringify({
                    ...activeRecord,
                    version: 2,
                    deleted_at: now,
                }),
                JSON.stringify(activeRecord),
                now,
            ],
        });

        const repairMigration = localMigrations.find(
            (migration) => migration.version === 4,
        );
        expect(repairMigration).toBeDefined();

        for (const statement of repairMigration!.statements) {
            sqliteDatabase.exec(statement);
        }

        expect(await repository.find(projectId)).toMatchObject({
            version: 2,
            deletedAt: null,
        });
        expect(await syncRepository.cursor()).toBe(0);
    });
});

function serverRecord(
    project: {
        id: string;
        title: string;
        completed: boolean;
        createdAt: string;
        updatedAt: string;
    },
    version: number,
): ServerProjectRecord {
    return {
        id: project.id,
        title: project.title,
        completed: project.completed,
        version,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
        deleted_at: null,
    };
}
