import { Head, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { TaskWorkspace } from '@/components/task-workspace';
import { rememberOfflineAppState } from '@/offline/app-state';
import { dashboard } from '@/routes';

export default function Dashboard() {
    const { auth, branding, name, sidebarOpen } = usePage().props;

    useEffect(() => {
        rememberOfflineAppState({
            name,
            user: auth.user,
            sidebarOpen,
            permissions: auth.permissions,
            branding,
        });
    }, [auth.permissions, auth.user, branding, name, sidebarOpen]);

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col overflow-x-auto rounded-xl p-4">
                <TaskWorkspace
                    userScope={String(auth.user.id)}
                    rememberUserScope
                />
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
