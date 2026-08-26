import { Head, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { ProjectWorkspace } from '@/components/project-workspace';
import { rememberOfflineAppState } from '@/offline/app-state';
import { projects } from '@/routes';

export default function Projects() {
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
            <Head title="Projects" />
            <div className="flex h-full flex-1 flex-col overflow-x-auto rounded-xl p-4">
                <ProjectWorkspace
                    userScope={String(auth.user.id)}
                    rememberUserScope
                />
            </div>
        </>
    );
}

Projects.layout = {
    breadcrumbs: [
        {
            title: 'Projects',
            href: projects(),
        },
    ],
};
