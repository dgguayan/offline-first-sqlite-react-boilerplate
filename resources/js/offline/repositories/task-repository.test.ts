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
import { SqliteTaskRepository } from '@/offline/repositories/task-repository';

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

    public async transaction(
        statements: readonly SqlStatement[],
    ): Promise<void> {
        this.database.transaction((transaction) => {
            for (const statement of statements) {
                transaction.exec({
                    sql: statement.sql,
                    bind: statement.parameters
                        ? Array.from(statement.parameters)
                        : undefined,
                });
            }
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

    beforeEach(async () => {
        const sqlite3 = await sqlite3InitModule();
        sqliteDatabase = new sqlite3.oo1.DB(':memory:', 'ct');
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
});
