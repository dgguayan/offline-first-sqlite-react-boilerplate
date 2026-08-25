import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getOfflineAppState,
    rememberOfflineAppState,
} from '@/offline/app-state';
import type { User } from '@/types';

describe('offline app state', () => {
    const values = new Map<string, string>();

    beforeEach(() => {
        values.clear();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('restores UI state only for the matching offline user', () => {
        const user: User = {
            id: 42,
            name: 'Local User',
            email: 'local@example.com',
            email_verified_at: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
        };

        rememberOfflineAppState({
            name: 'Offline Tasks',
            user,
            sidebarOpen: true,
        });

        expect(getOfflineAppState('42')).toEqual({
            name: 'Offline Tasks',
            user,
            sidebarOpen: true,
        });
        expect(getOfflineAppState('7')).toBeNull();
    });

    it('ignores malformed cached state', () => {
        values.set('offline-first-tasks.app-state.42', '{invalid');

        expect(getOfflineAppState('42')).toBeNull();
    });
});
