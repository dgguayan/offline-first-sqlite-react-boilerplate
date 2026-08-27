import type { PermissionScope, User } from '@/types';

export type OfflineAppState = {
    name: string;
    user: User;
    sidebarOpen: boolean;
    permissions?: Record<string, PermissionScope>;
};

const storageKeyPrefix = 'offline-first-tasks.app-state.';

export function rememberOfflineAppState(state: OfflineAppState): void {
    const displayUser: User = {
        id: state.user.id,
        name: state.user.name,
        email: state.user.email,
        avatar: state.user.avatar,
        email_verified_at: state.user.email_verified_at,
        created_at: state.user.created_at,
        updated_at: state.user.updated_at,
    };

    localStorage.setItem(
        `${storageKeyPrefix}${state.user.id}`,
        JSON.stringify({ ...state, user: displayUser }),
    );
}

export function getOfflineAppState(
    userScope: string | null,
): OfflineAppState | null {
    if (!userScope) {
        return null;
    }

    const storedState = localStorage.getItem(`${storageKeyPrefix}${userScope}`);

    if (!storedState) {
        return null;
    }

    try {
        const state = JSON.parse(storedState) as Partial<OfflineAppState>;

        if (
            typeof state.name !== 'string' ||
            typeof state.sidebarOpen !== 'boolean' ||
            !state.user ||
            String(state.user.id) !== userScope ||
            typeof state.user.name !== 'string' ||
            typeof state.user.email !== 'string'
        ) {
            return null;
        }

        return state as OfflineAppState;
    } catch {
        return null;
    }
}
