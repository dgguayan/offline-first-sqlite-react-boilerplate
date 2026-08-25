import { reportServerReachability } from '@/offline/connection-status';
import type { SqliteSyncRepository } from '@/offline/repositories/sync-repository';
import { SyncApiClient, SyncApiError } from '@/offline/sync/sync-api';
import type { OutboxMutation, SyncSummary } from '@/offline/types/sync';

export type SyncPhase =
    'idle' | 'syncing' | 'offline' | 'error' | 'auth-required';

export type SyncState = SyncSummary & {
    phase: SyncPhase;
    serverReachable: boolean | null;
    lastSyncedAt: string | null;
    lastError: string | null;
};

const initialState: SyncState = {
    phase: 'idle',
    serverReachable: null,
    pendingCount: 0,
    conflictCount: 0,
    rejectedCount: 0,
    lastSyncedAt: null,
    lastError: null,
};

export class SyncEngine {
    private readonly listeners = new Set<() => void>();

    private readonly deviceId = getOrCreateDeviceId();

    private state: SyncState = initialState;

    private activeSync: Promise<void> | null = null;

    private intervalId: number | null = null;

    private stopped = false;

    public constructor(
        private readonly repository: SqliteSyncRepository,
        private readonly api = new SyncApiClient(),
    ) {}

    public readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    };

    public readonly getSnapshot = (): SyncState => this.state;

    public async start(): Promise<void> {
        this.stopped = false;
        await this.repository.recoverInterruptedMutations();
        await this.refreshSummary();

        if (this.stopped) {
            return;
        }

        window.addEventListener('online', this.handleOnline);
        document.addEventListener('visibilitychange', this.handleVisibility);
        this.intervalId = window.setInterval(() => {
            void this.syncNow();
        }, 30_000);
        await this.syncNow();
    }

    public stop(): void {
        this.stopped = true;
        window.removeEventListener('online', this.handleOnline);
        document.removeEventListener('visibilitychange', this.handleVisibility);

        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    public async localDataChanged(): Promise<void> {
        await this.refreshSummary();
        void this.syncNow();
    }

    public syncNow(): Promise<void> {
        if (this.activeSync) {
            return this.activeSync;
        }

        this.activeSync = this.performSync().finally(() => {
            this.activeSync = null;
        });

        return this.activeSync;
    }

    private async performSync(): Promise<void> {
        this.setState({ phase: 'syncing', lastError: null });

        try {
            await this.api.health();
            reportServerReachability(true);
            this.setState({ serverReachable: true });
            await this.pushPending();
            await this.pullChanges();
            await this.refreshSummary();
            this.setState({
                phase: 'idle',
                serverReachable: true,
                lastSyncedAt: new Date().toISOString(),
                lastError: null,
            });
        } catch (error) {
            await this.refreshSummary();
            const syncError = normalizeSyncError(error);
            reportServerReachability(syncError.status !== null);
            this.setState({
                phase: syncError.isAuthenticationError()
                    ? 'auth-required'
                    : syncError.isRetryable()
                      ? 'offline'
                      : 'error',
                serverReachable: syncError.status === null ? false : true,
                lastError: syncError.message,
            });
        }
    }

    private async pushPending(): Promise<void> {
        while (true) {
            const mutations = await this.repository.claimPending(
                new Date().toISOString(),
            );

            if (mutations.length === 0) {
                return;
            }

            try {
                const response = await this.api.push(this.deviceId, mutations);
                const mutationsById = new Map(
                    mutations.map((mutation) => [mutation.id, mutation]),
                );

                for (const accepted of response.accepted) {
                    const mutation = mutationsById.get(accepted.mutation_id);

                    if (mutation) {
                        await this.repository.markAccepted(
                            mutation,
                            accepted.record,
                        );
                        mutationsById.delete(mutation.id);
                    }
                }

                for (const conflict of response.conflicts) {
                    const mutation = mutationsById.get(conflict.mutation_id);

                    if (mutation) {
                        await this.repository.markConflict(
                            mutation,
                            conflict.server_record,
                        );
                        mutationsById.delete(mutation.id);
                    }
                }

                for (const rejected of response.rejected) {
                    const mutation = mutationsById.get(rejected.mutation_id);

                    if (mutation) {
                        if (rejected.retryable) {
                            await this.retryMutation(
                                mutation,
                                rejected.message,
                            );
                        } else {
                            await this.repository.markRejected(
                                mutation,
                                rejected.message,
                            );
                        }

                        mutationsById.delete(mutation.id);
                    }
                }

                for (const mutation of mutationsById.values()) {
                    await this.retryMutation(
                        mutation,
                        'The server omitted this mutation result.',
                    );
                }
            } catch (error) {
                const syncError = normalizeSyncError(error);

                if (
                    syncError.isRetryable() ||
                    syncError.isAuthenticationError()
                ) {
                    for (const mutation of mutations) {
                        await this.retryMutation(mutation, syncError.message);
                    }
                } else if (!syncError.isAuthenticationError()) {
                    for (const mutation of mutations) {
                        await this.repository.markRejected(
                            mutation,
                            syncError.message,
                        );
                    }
                }

                throw syncError;
            }
        }
    }

    private async pullChanges(): Promise<void> {
        let hasMore = true;

        while (hasMore) {
            const cursor = await this.repository.cursor();
            const response = await this.api.pull(cursor);
            await this.repository.applyPullBatch(
                response.changes,
                response.next_cursor,
            );
            hasMore = response.has_more;
        }
    }

    private async retryMutation(
        mutation: OutboxMutation,
        message: string,
    ): Promise<void> {
        const delay = Math.min(
            5 * 60_000,
            2 ** Math.min(mutation.attempts, 6) * 5_000,
        );
        await this.repository.markRetry(
            mutation,
            message,
            new Date(Date.now() + delay).toISOString(),
        );
    }

    private async refreshSummary(): Promise<void> {
        this.setState(await this.repository.summary());
    }

    private setState(patch: Partial<SyncState>): void {
        this.state = { ...this.state, ...patch };

        for (const listener of this.listeners) {
            listener();
        }
    }

    private readonly handleOnline = (): void => {
        void this.syncNow();
    };

    private readonly handleVisibility = (): void => {
        if (document.visibilityState === 'visible') {
            void this.syncNow();
        }
    };
}

function getOrCreateDeviceId(): string {
    const key = 'offline-first-tasks.device-id';
    const existing = localStorage.getItem(key);

    if (existing) {
        return existing;
    }

    const deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);

    return deviceId;
}

function normalizeSyncError(error: unknown): SyncApiError {
    return error instanceof SyncApiError
        ? error
        : new SyncApiError(
              error instanceof Error ? error.message : 'Sync failed.',
              null,
          );
}
