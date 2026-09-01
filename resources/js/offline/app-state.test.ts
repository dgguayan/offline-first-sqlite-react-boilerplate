import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getOfflineAppState,
    rememberOfflineAppState,
} from '@/offline/app-state';
import type { User } from '@/types';
import type { Branding } from '@/types';

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
        const branding: Branding = {
            systemName: 'Offline Tasks',
            logoUrl: '/storage/branding/logo.svg?v=1',
            layout: 'vertical',
            titleAlignment: 'center',
            titleOverflow: 'wrap',
            sidebarLogoSize: 48,
            usesCustomLogo: true,
            isDefault: false,
            defaultSystemName: 'Laravel',
            updatedAt: '2026-01-01T00:00:00.000Z',
        };

        rememberOfflineAppState({
            name: 'Offline Tasks',
            user,
            sidebarOpen: true,
            branding,
        });

        expect(getOfflineAppState('42')).toEqual({
            name: 'Offline Tasks',
            user,
            sidebarOpen: true,
            branding,
        });
        expect(getOfflineAppState('7')).toBeNull();
    });

    it('ignores malformed cached state', () => {
        values.set('offline-first-tasks.app-state.42', '{invalid');

        expect(getOfflineAppState('42')).toBeNull();
    });

    it('adds safe title defaults to branding cached by an older build', () => {
        values.set(
            'offline-first-tasks.app-state.42',
            JSON.stringify({
                name: 'Older Offline Tasks',
                user: {
                    id: 42,
                    name: 'Local User',
                    email: 'local@example.com',
                },
                sidebarOpen: true,
                branding: {
                    systemName: 'Older Offline Tasks',
                    logoUrl: null,
                    layout: 'horizontal',
                    usesCustomLogo: false,
                },
            }),
        );

        expect(getOfflineAppState('42')?.branding).toMatchObject({
            titleAlignment: 'left',
            titleOverflow: 'ellipsis',
            sidebarLogoSize: 32,
        });
    });

    it('preserves task access in state cached before tasks had their own permission', () => {
        values.set(
            'offline-first-tasks.app-state.42',
            JSON.stringify({
                name: 'Older Offline Tasks',
                user: {
                    id: 42,
                    name: 'Local User',
                    email: 'local@example.com',
                },
                sidebarOpen: true,
                permissions: {
                    'dashboard.view': 'all',
                },
            }),
        );

        expect(getOfflineAppState('42')?.permissions).toEqual({
            'dashboard.view': 'all',
            'tasks.view': 'own',
        });
    });
});
