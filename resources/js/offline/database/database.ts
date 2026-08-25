import type {
    DatabaseStorageInfo,
    DatabaseWorkerRequest,
    DatabaseWorkerResponse,
    SqlParameter,
    SqlStatement,
} from '@/offline/database/messages';
import sqliteWorkerUrl from '@/offline/database/sqlite.worker?worker&url';

const activeUserStorageKey = 'offline-first-tasks.active-user';

export type LocalDatabaseInfo = DatabaseStorageInfo & {
    persistentStorageGranted: boolean;
};

export interface LocalDatabase {
    execute(sql: string, parameters?: readonly SqlParameter[]): Promise<void>;
    select<Row>(
        sql: string,
        parameters?: readonly SqlParameter[],
    ): Promise<Row[]>;
    transaction(statements: readonly SqlStatement[]): Promise<void>;
    transaction<Row>(
        statements: readonly SqlStatement[],
        resultStatement: SqlStatement,
    ): Promise<Row[]>;
    info(): LocalDatabaseInfo;
}

type PendingRequest = {
    resolve(value: unknown): void;
    reject(reason: Error): void;
};

export function createDatabaseWorker(
    workerUrl: string,
    pageOrigin: string,
): Worker {
    const resolvedWorkerUrl = new URL(workerUrl, import.meta.url);

    if (resolvedWorkerUrl.origin === pageOrigin) {
        return new Worker(resolvedWorkerUrl, {
            type: 'module',
            name: 'offline-first-sqlite',
        });
    }

    const bootstrapUrl = URL.createObjectURL(
        new Blob([`import ${JSON.stringify(resolvedWorkerUrl.href)};`], {
            type: 'text/javascript',
        }),
    );

    try {
        return new Worker(bootstrapUrl, {
            type: 'module',
            name: 'offline-first-sqlite',
        });
    } finally {
        URL.revokeObjectURL(bootstrapUrl);
    }
}

class WorkerDatabase implements LocalDatabase {
    private readonly pendingRequests = new Map<string, PendingRequest>();

    public constructor(
        private readonly worker: Worker,
        private readonly databaseInfo: LocalDatabaseInfo,
    ) {
        worker.addEventListener('message', this.handleMessage);
        worker.addEventListener('error', this.handleWorkerError);
    }

    public execute(
        sql: string,
        parameters?: readonly SqlParameter[],
    ): Promise<void> {
        return this.request({
            id: crypto.randomUUID(),
            type: 'execute',
            statement: { sql, parameters },
        });
    }

    public select<Row>(
        sql: string,
        parameters?: readonly SqlParameter[],
    ): Promise<Row[]> {
        return this.request({
            id: crypto.randomUUID(),
            type: 'select',
            statement: { sql, parameters },
        });
    }

    public transaction(statements: readonly SqlStatement[]): Promise<void>;
    public transaction<Row>(
        statements: readonly SqlStatement[],
        resultStatement: SqlStatement,
    ): Promise<Row[]>;
    public transaction<Row>(
        statements: readonly SqlStatement[],
        resultStatement?: SqlStatement,
    ): Promise<void | Row[]> {
        return this.request({
            id: crypto.randomUUID(),
            type: 'transaction',
            statements,
            resultStatement,
        });
    }

    public info(): LocalDatabaseInfo {
        return this.databaseInfo;
    }

    public close(): void {
        void this.request({
            id: crypto.randomUUID(),
            type: 'close',
        }).finally(() => {
            this.destroy();
        });
    }

    public destroy(): void {
        this.worker.removeEventListener('message', this.handleMessage);
        this.worker.removeEventListener('error', this.handleWorkerError);
        this.worker.terminate();

        for (const request of this.pendingRequests.values()) {
            request.reject(new Error('The local database worker was closed.'));
        }

        this.pendingRequests.clear();
    }

    private request<Result>(request: DatabaseWorkerRequest): Promise<Result> {
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(request.id, {
                resolve: (value) => resolve(value as Result),
                reject,
            });
            this.worker.postMessage(request);
        });
    }

    private readonly handleMessage = (
        event: MessageEvent<DatabaseWorkerResponse>,
    ): void => {
        const pendingRequest = this.pendingRequests.get(event.data.id);

        if (!pendingRequest) {
            return;
        }

        this.pendingRequests.delete(event.data.id);

        if (event.data.error) {
            const error = new Error(event.data.error.message);
            error.name = event.data.error.name;
            pendingRequest.reject(error);

            return;
        }

        pendingRequest.resolve(event.data.value);
    };

    private readonly handleWorkerError = (event: ErrorEvent): void => {
        const error = new Error(
            event.message || 'The local database worker failed.',
        );

        for (const request of this.pendingRequests.values()) {
            request.reject(error);
        }

        this.pendingRequests.clear();
    };
}

let activeDatabaseScope: string | null = null;
let activeDatabasePromise: Promise<WorkerDatabase> | null = null;
let activeDatabase: WorkerDatabase | null = null;
let activeWorker: Worker | null = null;
let releaseDatabaseLock: (() => void) | null = null;
let databaseGeneration = 0;

function normalizeUserScope(userScope: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(userScope)) {
        throw new Error('The local database user scope is invalid.');
    }

    return userScope;
}

async function acquireDatabaseLock(userScope: string): Promise<() => void> {
    if (!navigator.locks) {
        return () => undefined;
    }

    let release: (() => void) | null = null;

    const acquired = new Promise<void>((resolve, reject) => {
        void navigator.locks.request(
            `offline-first-tasks:${userScope}`,
            { ifAvailable: true, mode: 'exclusive' },
            async (lock) => {
                if (!lock) {
                    reject(
                        new Error(
                            'The local task database is already open in another tab.',
                        ),
                    );

                    return;
                }

                resolve();
                await new Promise<void>((releaseLock) => {
                    release = releaseLock;
                });
            },
        );
    });

    await acquired;

    return () => release?.();
}

async function requestPersistentStorage(): Promise<boolean> {
    if (!navigator.storage?.persist) {
        return false;
    }

    try {
        if (await navigator.storage.persisted()) {
            return true;
        }

        return await navigator.storage.persist();
    } catch {
        return false;
    }
}

export function rememberActiveOfflineUser(userScope: string): void {
    localStorage.setItem(activeUserStorageKey, normalizeUserScope(userScope));
}

export function getActiveOfflineUser(): string | null {
    const userScope = localStorage.getItem(activeUserStorageKey);

    if (!userScope || !/^[a-zA-Z0-9_-]+$/.test(userScope)) {
        return null;
    }

    return userScope;
}

export function initializeDatabase(userScope: string): Promise<LocalDatabase> {
    const normalizedScope = normalizeUserScope(userScope);

    if (activeDatabasePromise && activeDatabaseScope === normalizedScope) {
        return activeDatabasePromise;
    }

    if (activeDatabasePromise) {
        deactivateDatabase();
    }

    const generation = ++databaseGeneration;
    activeDatabaseScope = normalizedScope;
    activeDatabasePromise = (async () => {
        const releaseLock = await acquireDatabaseLock(normalizedScope);

        if (generation !== databaseGeneration) {
            releaseLock();

            throw new Error('Local database initialization was cancelled.');
        }

        releaseDatabaseLock = releaseLock;

        const worker = createDatabaseWorker(
            sqliteWorkerUrl,
            window.location.origin,
        );
        activeWorker = worker;
        const persistentStorageGranted = await requestPersistentStorage();
        const initialResponse = await sendInitializationRequest(
            worker,
            normalizedScope,
        );

        if (generation !== databaseGeneration) {
            worker.terminate();

            throw new Error('Local database initialization was cancelled.');
        }

        activeDatabase = new WorkerDatabase(worker, {
            ...initialResponse,
            persistentStorageGranted,
        });

        return activeDatabase;
    })().catch((error: unknown) => {
        if (generation === databaseGeneration) {
            deactivateDatabase();
        }

        throw error;
    });

    return activeDatabasePromise;
}

function sendInitializationRequest(
    worker: Worker,
    userScope: string,
): Promise<DatabaseStorageInfo> {
    return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();

        const handleMessage = (
            event: MessageEvent<DatabaseWorkerResponse>,
        ): void => {
            if (event.data.id !== requestId) {
                return;
            }

            cleanup();

            if (event.data.error) {
                const error = new Error(event.data.error.message);
                error.name = event.data.error.name;
                reject(error);

                return;
            }

            resolve(event.data.value as DatabaseStorageInfo);
        };

        const handleError = (event: ErrorEvent): void => {
            cleanup();
            reject(new Error(event.message || 'Unable to start SQLite.'));
        };

        const cleanup = (): void => {
            worker.removeEventListener('message', handleMessage);
            worker.removeEventListener('error', handleError);
        };

        worker.addEventListener('message', handleMessage);
        worker.addEventListener('error', handleError);
        worker.postMessage({
            id: requestId,
            type: 'initialize',
            userScope,
        } satisfies DatabaseWorkerRequest);
    });
}

function deactivateDatabase(): void {
    databaseGeneration += 1;

    if (activeDatabase) {
        activeDatabase.destroy();
    } else {
        activeWorker?.terminate();
    }

    activeDatabase = null;
    activeWorker = null;
    activeDatabasePromise = null;
    activeDatabaseScope = null;
    releaseDatabaseLock?.();
    releaseDatabaseLock = null;
}

export function deactivateOfflineUser(): void {
    localStorage.removeItem(activeUserStorageKey);
    deactivateDatabase();
}
