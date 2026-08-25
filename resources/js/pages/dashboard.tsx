import { Head, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { TaskWorkspace } from '@/components/task-workspace';
import { rememberOfflineAppState } from '@/offline/app-state';
import { dashboard } from '@/routes';

export default function Dashboard() {
    const { auth, name, sidebarOpen } = usePage().props;

    useEffect(() => {
        rememberOfflineAppState({
            name,
            user: auth.user,
            sidebarOpen,
        });
    }, [auth.user, name, sidebarOpen]);

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
