import {
    defaultSidebarLogoSize,
    maximumSidebarLogoSize,
    minimumSidebarLogoSize,
} from '@/types';
import type {
    Branding,
    BrandingTitleAlignment,
    BrandingTitleOverflow,
    PermissionScope,
    User,
} from '@/types';

export type OfflineAppState = {
    name: string;
    user: User;
    sidebarOpen: boolean;
    permissions?: Record<string, PermissionScope>;
    branding?: Branding;
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
            typeof state.user.email !== 'string' ||
            (state.branding !== undefined &&
                (typeof state.branding.systemName !== 'string' ||
                    typeof state.branding.layout !== 'string' ||
                    typeof state.branding.usesCustomLogo !== 'boolean'))
        ) {
            return null;
        }

        if (state.branding) {
            state.branding.titleAlignment = normalizeTitleAlignment(
                state.branding.titleAlignment,
            );
            state.branding.titleOverflow = normalizeTitleOverflow(
                state.branding.titleOverflow,
            );
            state.branding.sidebarLogoSize = normalizeSidebarLogoSize(
                state.branding.sidebarLogoSize,
            );
        }

        return state as OfflineAppState;
    } catch {
        return null;
    }
}

function normalizeTitleAlignment(value: unknown): BrandingTitleAlignment {
    return value === 'center' || value === 'right' ? value : 'left';
}

function normalizeTitleOverflow(value: unknown): BrandingTitleOverflow {
    return value === 'clip' || value === 'wrap' ? value : 'ellipsis';
}

function normalizeSidebarLogoSize(value: unknown): number {
    return typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= minimumSidebarLogoSize &&
        value <= maximumSidebarLogoSize
        ? value
        : defaultSidebarLogoSize;
}
