import { useEffect, useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
let serverReachable: boolean | null = null;
let isListening = false;
let snapshot = !browserOnline;

export function reportServerReachability(reachable: boolean): void {
    serverReachable = reachable;
    updateSnapshot();
}

export function initializeConnectionStatus(): void {
    startListening();
}

export function isAppOffline(): boolean {
    return snapshot;
}

export function useIsOffline(): boolean {
    useEffect(() => {
        initializeConnectionStatus();
    }, []);

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function startListening(): void {
    if (isListening || typeof window === 'undefined') {
        return;
    }

    isListening = true;
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
    return snapshot;
}

function getServerSnapshot(): boolean {
    return false;
}

function handleOnline(): void {
    browserOnline = true;
    updateSnapshot();
}

function handleOffline(): void {
    browserOnline = false;
    updateSnapshot();
}

function updateSnapshot(): void {
    const nextSnapshot = !browserOnline || serverReachable === false;

    if (snapshot === nextSnapshot) {
        return;
    }

    snapshot = nextSnapshot;

    for (const listener of listeners) {
        listener();
    }
}
