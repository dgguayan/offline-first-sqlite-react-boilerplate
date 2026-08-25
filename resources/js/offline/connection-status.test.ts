import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('connection status', () => {
    const handlers = new Map<string, () => void>();

    beforeEach(() => {
        vi.resetModules();
        handlers.clear();
        vi.stubGlobal('navigator', { onLine: true });
        vi.stubGlobal('window', {
            addEventListener: (name: string, handler: () => void) => {
                handlers.set(name, handler);
            },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('tracks browser offline and online events immediately', async () => {
        const status = await import('@/offline/connection-status');
        status.initializeConnectionStatus();

        expect(status.isAppOffline()).toBe(false);

        handlers.get('offline')?.();
        expect(status.isAppOffline()).toBe(true);

        handlers.get('online')?.();
        expect(status.isAppOffline()).toBe(false);
    });

    it('keeps the indicator visible until Laravel is reachable again', async () => {
        const status = await import('@/offline/connection-status');

        status.reportServerReachability(false);
        expect(status.isAppOffline()).toBe(true);

        status.reportServerReachability(true);
        expect(status.isAppOffline()).toBe(false);
    });
});
