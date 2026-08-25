import { Head, usePage } from '@inertiajs/react';
import { TaskWorkspace } from '@/components/task-workspace';
import { dashboard } from '@/routes';

export default function Dashboard() {
    const { auth } = usePage().props;

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
