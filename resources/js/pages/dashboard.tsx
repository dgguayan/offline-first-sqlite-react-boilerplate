import { Head, Link, usePage } from '@inertiajs/react';
import {
    Activity,
    ArrowRight,
    ChartNoAxesCombined,
    FolderKanban,
    ListTodo,
} from 'lucide-react';
import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useRememberOfflineAppState } from '@/hooks/use-remember-offline-app-state';
import { useIsOffline } from '@/offline/connection-status';
import { dashboard, projects, tasks } from '@/routes';

export default function Dashboard() {
    const { auth } = usePage().props;
    const canViewTasks = 'tasks.view' in auth.permissions;
    const canViewProjects = 'projects.view' in auth.permissions;
    const isOffline = useIsOffline();

    useRememberOfflineAppState();

    const handleOfflineNavigation = (
        event: MouseEvent<Element>,
        targetUrl: string,
    ): void => {
        if (
            !isOffline ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }

        event.preventDefault();
        window.location.assign(targetUrl);
    };

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                <header className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        A focused overview of your workspace, activity, and
                        progress.
                    </p>
                </header>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Card className="md:col-span-2 xl:col-span-2">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    <ChartNoAxesCombined className="size-4" />
                                </div>
                                <div className="space-y-1">
                                    <CardTitle>Workspace overview</CardTitle>
                                    <CardDescription>
                                        A foundation for summary cards, metrics,
                                        charts, and progress.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed bg-muted/30 p-6 text-center">
                                <p className="max-w-md text-sm text-muted-foreground">
                                    Dashboard widgets can be added here without
                                    affecting the offline task workspace.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Quick actions</CardTitle>
                            <CardDescription>
                                Open an independent workspace.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            {canViewTasks && (
                                <Button asChild className="justify-between">
                                    <Link
                                        href={tasks()}
                                        onClick={(event) =>
                                            handleOfflineNavigation(
                                                event,
                                                tasks.url(),
                                            )
                                        }
                                    >
                                        <span className="flex items-center gap-2">
                                            <ListTodo />
                                            Offline-first Tasks
                                        </span>
                                        <ArrowRight />
                                    </Link>
                                </Button>
                            )}
                            {canViewProjects && (
                                <Button
                                    asChild
                                    variant="outline"
                                    className="justify-between"
                                >
                                    <Link
                                        href={projects()}
                                        onClick={(event) =>
                                            handleOfflineNavigation(
                                                event,
                                                projects.url(),
                                            )
                                        }
                                    >
                                        <span className="flex items-center gap-2">
                                            <FolderKanban />
                                            Projects
                                        </span>
                                        <ArrowRight />
                                    </Link>
                                </Button>
                            )}
                            {!canViewTasks && !canViewProjects && (
                                <p className="text-sm text-muted-foreground">
                                    No workspace shortcuts are available for
                                    your current permissions.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2 xl:col-span-3">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                    <Activity className="size-4" />
                                </div>
                                <div className="space-y-1">
                                    <CardTitle>Recent activity</CardTitle>
                                    <CardDescription>
                                        Ready for a dedicated activity feed or
                                        progress summary.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>
                </div>
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
