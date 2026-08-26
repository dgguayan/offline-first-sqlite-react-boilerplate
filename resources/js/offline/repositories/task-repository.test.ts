import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    LocalDatabase,
    LocalDatabaseInfo,
} from '@/offline/database/database';
import type { SqlParameter, SqlStatement } from '@/offline/database/messages';
import {
    createMigrationsTableSql,
    localMigrations,
} from '@/offline/database/schema';
import { SqliteSyncRepository } from '@/offline/repositories/sync-repository';
import { SqliteTaskRepository } from '@/offline/repositories/task-repository';
import type { ServerTaskRecord } from '@/offline/types/sync';

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

describe('SqliteTaskRepository', () => {
    let sqliteDatabase: SQLiteDatabase;
    let repository: SqliteTaskRepository;
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

        repository = new SqliteTaskRepository(
            new MemoryDatabase(sqliteDatabase),
        );
        syncRepository = new SqliteSyncRepository(
            new MemoryDatabase(sqliteDatabase),
            () => repository.notifyExternalChange(),
        );
    });

    afterEach(() => {
        sqliteDatabase.close();
    });

    it('creates and reads a task using SQLite', async () => {
        const createdTask = await repository.create({
            title: '  Inspect equipment  ',
        });

        expect(createdTask.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        expect(await repository.find(createdTask.id)).toEqual(createdTask);
        expect(await repository.all()).toEqual([createdTask]);
    });

    it('updates, completes, and removes a task', async () => {
        const task = await repository.create({ title: 'First title' });
        const updatedTask = await repository.update(task.id, {
            title: 'Final title',
            completed: true,
        });

        expect(updatedTask).toMatchObject({
            id: task.id,
            title: 'Final title',
            completed: true,
        });

        await repository.remove(task.id);

        expect(await repository.find(task.id)).toBeNull();
        expect(
            sqliteDatabase.selectValue(
                'SELECT COUNT(*) FROM sync_outbox WHERE entity_id = ?',
                task.id,
            ),
        ).toBe(0);
    });

    it('notifies subscribers after local writes', async () => {
        const listener = vi.fn();
        const unsubscribe = repository.subscribe(listener);
        const task = await repository.create({ title: 'Subscribed task' });

        await repository.update(task.id, { completed: true });
        await repository.remove(task.id);

        expect(listener).toHaveBeenCalledTimes(3);

        unsubscribe();
        await repository.create({ title: 'No notification' });
        expect(listener).toHaveBeenCalledTimes(3);
    });

    it('rejects invalid titles before writing', async () => {
        await expect(repository.create({ title: '   ' })).rejects.toThrow(
            'A task title is required.',
        );
        expect(await repository.all()).toEqual([]);
    });

    it('coalesces unsent edits into one atomic create mutation', async () => {
        const task = await repository.create({ title: 'First draft' });

        await repository.update(task.id, { title: 'Final draft' });
        await repository.update(task.id, { completed: true });

        const mutations = await syncRepository.claimPending(
            new Date().toISOString(),
        );

        expect(mutations).toHaveLength(1);
        expect(mutations[0]).toMatchObject({
            entityId: task.id,
            operation: 'create',
            baseVersion: null,
            payload: {
                title: 'Final draft',
                completed: true,
            },
        });
    });

    it('keeps an in-flight payload immutable and rebases a newer edit', async () => {
        const task = await repository.create({ title: 'Original' });
        const [createMutation] = await syncRepository.claimPending(
            new Date().toISOString(),
        );

        await repository.update(task.id, { title: 'Edited during sync' });
        await syncRepository.markAccepted(
            createMutation,
            serverRecord(task, 1),
        );

        const localTask = await repository.find(task.id);
        const [updateMutation] = await syncRepository.claimPending(
            new Date().toISOString(),
        );

        expect(localTask).toMatchObject({
            title: 'Edited during sync',
            version: 1,
            syncStatus: 'pending',
        });
        expect(updateMutation).toMatchObject({
            operation: 'update',
            baseVersion: 1,
            payload: { title: 'Edited during sync' },
        });
    });

    it('preserves both versions until a conflict is explicitly resolved', async () => {
        const task = await repository.create({ title: 'Initial' });
        const [createMutation] = await syncRepository.claimPending(
            new Date().toISOString(),
        );
        await syncRepository.markAccepted(
            createMutation,
            serverRecord(task, 1),
        );
        await repository.update(task.id, { title: 'Local edit' });
        const [updateMutation] = await syncRepository.claimPending(
            new Date().toISOString(),
        );
        const remoteRecord = {
            ...serverRecord(task, 2),
            title: 'Server edit',
        };

        await syncRepository.markConflict(updateMutation, remoteRecord);

        expect(await syncRepository.conflicts('task')).toMatchObject([
            {
                entityType: 'task',
                entityId: task.id,
                localRecord: { title: 'Local edit' },
                serverRecord: { title: 'Server edit', version: 2 },
            },
        ]);
        expect(await repository.find(task.id)).toMatchObject({
            title: 'Local edit',
            syncStatus: 'conflict',
        });

        await syncRepository.useServerVersion('task', task.id);

        expect(await repository.find(task.id)).toMatchObject({
            title: 'Server edit',
            version: 2,
            syncStatus: 'synced',
        });
        expect(await syncRepository.conflicts('task')).toEqual([]);
    });
});

function serverRecord(
    task: {
        id: string;
        title: string;
        completed: boolean;
        createdAt: string;
        updatedAt: string;
    },
    version: number,
): ServerTaskRecord {
    return {
        id: task.id,
        title: task.title,
        completed: task.completed,
        version,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
        deleted_at: null,
    };
}
