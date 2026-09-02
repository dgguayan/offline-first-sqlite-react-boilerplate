import { Head, Link, usePage } from '@inertiajs/react';
import { AlertCircle, ArrowRight, FolderKanban, ListTodo } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { ActivityAreaChart } from '@/components/dashboard/activity-area-chart';
import { MetricCard } from '@/components/dashboard/metric-card';
import {
    StatusDonutChart,
    WorkloadBarChart,
} from '@/components/dashboard/status-charts';
import { createWorkspaceColumns } from '@/components/dashboard/workspace-columns';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDashboardWorkspaceData } from '@/hooks/use-dashboard-workspace-data';
import { useRememberOfflineAppState } from '@/hooks/use-remember-offline-app-state';
import { buildDashboardView } from '@/lib/dashboard';
import type { DashboardRange, DashboardWorkspaceItem } from '@/lib/dashboard';
import { useIsOffline } from '@/offline/connection-status';
import { dashboard, projects, tasks } from '@/routes';

type WorkspaceFilter = 'all' | 'projects' | 'sync' | 'tasks';

export default function Dashboard() {
    const { auth } = usePage().props;
    const canViewTasks = 'tasks.view' in auth.permissions;
    const canViewProjects = 'projects.view' in auth.permissions;
    const isOffline = useIsOffline();
    const [range, setRange] = useState<DashboardRange>(30);
    const [workspaceFilter, setWorkspaceFilter] =
        useState<WorkspaceFilter>('all');
    const userScope =
        Number.isSafeInteger(auth.user.id) && auth.user.id > 0
            ? String(auth.user.id)
            : null;
    const workspaceData = useDashboardWorkspaceData({
        includeProjects: canViewProjects,
        includeTasks: canViewTasks,
        userScope,
    });
    const dashboardView = useMemo(
        () =>
            buildDashboardView(
                workspaceData.tasks,
                workspaceData.projects,
                range,
            ),
        [range, workspaceData.projects, workspaceData.tasks],
    );

    useRememberOfflineAppState();

    const handleNavigation = useCallback(
        (event: MouseEvent<Element>, targetUrl: string): void => {
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
        },
        [isOffline],
    );
    const workspaceColumns = useMemo(
        () => createWorkspaceColumns(handleNavigation),
        [handleNavigation],
    );
    const filteredWorkspaceItems = useMemo(
        () =>
            filterWorkspaceItems(dashboardView.workspaceItems, workspaceFilter),
        [dashboardView.workspaceItems, workspaceFilter],
    );

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Dashboard
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Your workspace progress, activity, and locally
                            available data at a glance.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {canViewTasks && (
                            <Button asChild size="sm">
                                <Link
                                    href={tasks()}
                                    onClick={(event) =>
                                        handleNavigation(event, tasks.url())
                                    }
                                >
                                    <ListTodo />
                                    Open Tasks
                                </Link>
                            </Button>
                        )}
                        {canViewProjects && (
                            <Button asChild variant="outline" size="sm">
                                <Link
                                    href={projects()}
                                    onClick={(event) =>
                                        handleNavigation(event, projects.url())
                                    }
                                >
                                    <FolderKanban />
                                    Open Projects
                                </Link>
                            </Button>
                        )}
                    </div>
                </header>

                {workspaceData.status === 'error' && (
                    <div
                        role="alert"
                        className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
                    >
                        <AlertCircle
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-destructive"
                        />
                        <div>
                            <p className="font-medium">
                                Local workspace insights are unavailable
                            </p>
                            <p className="mt-1 text-muted-foreground">
                                {workspaceData.error}
                            </p>
                        </div>
                    </div>
                )}

                {workspaceData.status === 'loading' ? (
                    <DashboardSkeleton />
                ) : (
                    <>
                        <section
                            aria-label="Workspace metrics"
                            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
                        >
                            {dashboardView.metrics.map((metric) => (
                                <MetricCard key={metric.key} metric={metric} />
                            ))}
                        </section>

                        <Card className="gap-0 py-0">
                            <CardContent className="p-5 sm:p-6">
                                <ActivityAreaChart
                                    data={dashboardView.activity}
                                    range={range}
                                    onRangeChange={setRange}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="gap-1">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="space-y-1">
                                        <CardTitle>
                                            Recent workspace items
                                        </CardTitle>
                                        <CardDescription>
                                            Browse locally available tasks and
                                            projects without changing their
                                            data.
                                        </CardDescription>
                                    </div>
                                    <span className="text-sm text-muted-foreground tabular-nums">
                                        {dashboardView.totalRecords.toLocaleString()}{' '}
                                        total
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <DataTable
                                    columns={workspaceColumns}
                                    data={filteredWorkspaceItems}
                                    initialPageSize={5}
                                    initialSorting={[
                                        { id: 'updatedAt', desc: true },
                                    ]}
                                    searchPlaceholder="Search workspace items..."
                                    emptyMessage="No workspace items match this view."
                                    toolbarStart={
                                        <WorkspaceFilterToggle
                                            value={workspaceFilter}
                                            canViewProjects={canViewProjects}
                                            canViewTasks={canViewTasks}
                                            onChange={setWorkspaceFilter}
                                        />
                                    }
                                />
                            </CardContent>
                        </Card>

                        <section
                            aria-label="Workspace charts"
                            className="grid gap-4 xl:grid-cols-2"
                        >
                            <Card>
                                <CardContent>
                                    <StatusDonutChart
                                        data={dashboardView.breakdown}
                                    />
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent>
                                    <WorkloadBarChart
                                        data={dashboardView.breakdown}
                                    />
                                </CardContent>
                            </Card>
                        </section>

                        {!canViewTasks && !canViewProjects && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        No workspace data access
                                    </CardTitle>
                                    <CardDescription>
                                        Your current permissions do not include
                                        Tasks or Projects. Dashboard widgets
                                        remain empty until access is granted.
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        )}

                        {(canViewTasks || canViewProjects) && (
                            <Card className="gap-4 py-5">
                                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                        <p className="font-medium">
                                            Continue working
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            CRUD and offline sync remain in
                                            their independent workspaces.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {canViewTasks && (
                                            <Button asChild variant="outline">
                                                <Link
                                                    href={tasks()}
                                                    onClick={(event) =>
                                                        handleNavigation(
                                                            event,
                                                            tasks.url(),
                                                        )
                                                    }
                                                >
                                                    Tasks
                                                    <ArrowRight />
                                                </Link>
                                            </Button>
                                        )}
                                        {canViewProjects && (
                                            <Button asChild variant="outline">
                                                <Link
                                                    href={projects()}
                                                    onClick={(event) =>
                                                        handleNavigation(
                                                            event,
                                                            projects.url(),
                                                        )
                                                    }
                                                >
                                                    Projects
                                                    <ArrowRight />
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </>
    );
}

function WorkspaceFilterToggle({
    value,
    canViewProjects,
    canViewTasks,
    onChange,
}: {
    value: WorkspaceFilter;
    canViewProjects: boolean;
    canViewTasks: boolean;
    onChange: (value: WorkspaceFilter) => void;
}) {
    return (
        <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={value}
            onValueChange={(nextValue) => {
                if (
                    nextValue === 'all' ||
                    nextValue === 'tasks' ||
                    nextValue === 'projects' ||
                    nextValue === 'sync'
                ) {
                    onChange(nextValue);
                }
            }}
            aria-label="Filter workspace items"
            className="max-w-full overflow-x-auto"
        >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            {canViewTasks && (
                <ToggleGroupItem value="tasks">Tasks</ToggleGroupItem>
            )}
            {canViewProjects && (
                <ToggleGroupItem value="projects">Projects</ToggleGroupItem>
            )}
            <ToggleGroupItem value="sync">Needs sync</ToggleGroupItem>
        </ToggleGroup>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6" aria-label="Loading dashboard">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                    <Card key={index} className="gap-4 py-5">
                        <CardHeader className="gap-3 px-5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-20" />
                        </CardHeader>
                        <CardContent className="space-y-2 px-5">
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-3 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Card>
                <CardContent>
                    <Skeleton className="h-[320px] w-full" />
                </CardContent>
            </Card>
            <Card>
                <CardContent>
                    <Skeleton className="h-[360px] w-full" />
                </CardContent>
            </Card>
        </div>
    );
}

function filterWorkspaceItems(
    items: DashboardWorkspaceItem[],
    filter: WorkspaceFilter,
): DashboardWorkspaceItem[] {
    if (filter === 'tasks' || filter === 'projects') {
        const type = filter === 'tasks' ? 'task' : 'project';

        return items.filter((item) => item.type === type);
    }

    if (filter === 'sync') {
        return items.filter((item) => item.syncStatus !== 'synced');
    }

    return items;
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
