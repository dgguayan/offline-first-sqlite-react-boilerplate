import { Head, usePage } from '@inertiajs/react';
import { TaskWorkspace } from '@/components/task-workspace';
import { useRememberOfflineAppState } from '@/hooks/use-remember-offline-app-state';
import { tasks } from '@/routes';

export default function Tasks() {
    const { auth } = usePage().props;

    useRememberOfflineAppState();

    return (
        <>
            <Head title="Offline-first Tasks" />
            <div className="flex h-full flex-1 flex-col overflow-x-auto rounded-xl p-4">
                <TaskWorkspace
                    userScope={String(auth.user.id)}
                    rememberUserScope
                />
            </div>
        </>
    );
}

Tasks.layout = {
    breadcrumbs: [
        {
            title: 'Offline-first Tasks',
            href: tasks(),
        },
    ],
};
