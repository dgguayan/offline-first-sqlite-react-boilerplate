import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { rememberOfflineAppState } from '@/offline/app-state';
import { rememberActiveOfflineUser } from '@/offline/database/database';

export function useRememberOfflineAppState(): void {
    const { auth, branding, name, sidebarOpen } = usePage().props;

    useEffect(() => {
        if (!Number.isSafeInteger(auth.user.id) || auth.user.id <= 0) {
            return;
        }

        rememberActiveOfflineUser(String(auth.user.id));
        rememberOfflineAppState({
            name,
            user: auth.user,
            sidebarOpen,
            permissions: auth.permissions,
            branding,
        });
    }, [auth.permissions, auth.user, branding, name, sidebarOpen]);
}
