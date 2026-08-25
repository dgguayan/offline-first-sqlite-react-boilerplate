import { useSyncExternalStore } from 'react';
import type { SyncEngine, SyncState } from '@/offline/sync/sync-engine';

const unavailableState: SyncState = {
    phase: 'idle',
    serverReachable: null,
    pendingCount: 0,
    conflictCount: 0,
    rejectedCount: 0,
    lastSyncedAt: null,
    lastError: null,
};

const noopSubscribe = (): (() => void) => () => undefined;

export function useSyncState(engine: SyncEngine | null): SyncState {
    return useSyncExternalStore(
        engine?.subscribe ?? noopSubscribe,
        engine?.getSnapshot ?? getUnavailableState,
        getUnavailableState,
    );
}

function getUnavailableState(): SyncState {
    return unavailableState;
}
