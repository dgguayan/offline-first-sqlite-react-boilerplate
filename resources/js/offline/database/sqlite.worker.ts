/// <reference lib="webworker" />

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type {
    DatabaseStorageInfo,
    DatabaseWorkerRequest,
    DatabaseWorkerResponse,
    SqlStatement,
} from '@/offline/database/messages';
import {
    createMigrationsTableSql,
    localMigrations,
} from '@/offline/database/schema';

type SQLiteDatabase = Awaited<
    ReturnType<typeof sqlite3InitModule>
>['oo1']['DB']['prototype'];

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

let database: SQLiteDatabase | null = null;

function normalizeUserScope(userScope: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(userScope)) {
        throw new Error('The local database user scope is invalid.');
    }

    return userScope;
}

function executeStatement(
    sqliteDatabase: SQLiteDatabase,
    statement: SqlStatement,
): void {
    sqliteDatabase.exec({
        sql: statement.sql,
        bind: statement.parameters
            ? Array.from(statement.parameters)
            : undefined,
    });
}

function runMigrations(sqliteDatabase: SQLiteDatabase): void {
    sqliteDatabase.exec(createMigrationsTableSql);

    const appliedVersions = new Set(
        sqliteDatabase
            .selectValues(
                'SELECT version FROM local_schema_migrations ORDER BY version',
            )
            .map(Number),
    );

    for (const migration of localMigrations) {
        if (appliedVersions.has(migration.version)) {
            continue;
        }

        sqliteDatabase.transaction('IMMEDIATE', (transaction) => {
            for (const statement of migration.statements) {
                transaction.exec(statement);
            }

            transaction.exec({
                sql: `
                    INSERT INTO local_schema_migrations (version, applied_at)
                    VALUES (?, ?)
                `,
                bind: [migration.version, new Date().toISOString()],
            });
        });
    }
}

async function initializeDatabase(
    userScope: string,
): Promise<DatabaseStorageInfo> {
    if (database) {
        throw new Error('The local database has already been initialized.');
    }

    if (!navigator.storage?.getDirectory) {
        throw new DOMException(
            'This browser does not support the Origin Private File System.',
            'NotSupportedError',
        );
    }

    const normalizedScope = normalizeUserScope(userScope);
    const sqlite3 = await sqlite3InitModule();
    const pool = await sqlite3.installOpfsSAHPoolVfs({
        name: `offline_tasks_${normalizedScope}`,
        directory: `/offline-first-tasks/user-${normalizedScope}`,
        initialCapacity: 8,
    });

    database = new pool.OpfsSAHPoolDb('/tasks.sqlite3');
    database.exec('PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;');
    runMigrations(database);

    return {
        persistence: 'opfs',
        sqliteVersion: sqlite3.version.libVersion,
    };
}

function requireDatabase(): SQLiteDatabase {
    if (!database) {
        throw new Error('The local database is not initialized.');
    }

    return database;
}

async function handleRequest(request: DatabaseWorkerRequest): Promise<unknown> {
    switch (request.type) {
        case 'initialize':
            return initializeDatabase(request.userScope);
        case 'execute':
            executeStatement(requireDatabase(), request.statement);

            return undefined;
        case 'select':
            return requireDatabase().exec({
                sql: request.statement.sql,
                bind: request.statement.parameters
                    ? Array.from(request.statement.parameters)
                    : undefined,
                rowMode: 'object',
                returnValue: 'resultRows',
            });
        case 'transaction':
            requireDatabase().transaction('IMMEDIATE', (transaction) => {
                for (const statement of request.statements) {
                    executeStatement(transaction, statement);
                }
            });

            return undefined;
        case 'close':
            database?.close();
            database = null;

            return undefined;
    }
}

workerScope.addEventListener(
    'message',
    async (event: MessageEvent<DatabaseWorkerRequest>) => {
        const response: DatabaseWorkerResponse = { id: event.data.id };

        try {
            response.value = await handleRequest(event.data);
        } catch (error) {
            response.error = {
                name: error instanceof Error ? error.name : 'Error',
                message:
                    error instanceof Error
                        ? error.message
                        : 'An unknown database error occurred.',
            };
        }

        workerScope.postMessage(response);
    },
);
