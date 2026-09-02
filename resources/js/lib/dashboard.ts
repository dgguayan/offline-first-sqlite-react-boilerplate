import type { Project } from '@/offline/types/project';
import type { Task } from '@/offline/types/task';

export type DashboardRange = 7 | 30 | 90;

export type DashboardWorkspaceItem = {
    id: string;
    title: string;
    type: 'project' | 'task';
    status: 'completed' | 'open';
    syncStatus: Task['syncStatus'] | Project['syncStatus'];
    createdAt: string;
    updatedAt: string;
};

export type DashboardMetric = {
    key: 'tasks' | 'completed' | 'projects' | 'completion';
    title: string;
    value: string;
    trend: number;
    trendLabel: string;
    description: string;
};

export type DashboardActivityPoint = {
    date: string;
    label: string;
    tasks: number;
    projects: number;
};

export type DashboardBreakdownPoint = {
    key:
        'completedTasks' | 'openTasks' | 'activeProjects' | 'completedProjects';
    label: string;
    value: number;
    fill: string;
};

export type DashboardView = {
    metrics: DashboardMetric[];
    activity: DashboardActivityPoint[];
    workspaceItems: DashboardWorkspaceItem[];
    breakdown: DashboardBreakdownPoint[];
    totalRecords: number;
};

type WorkspaceRecord = Task | Project;

export function buildDashboardView(
    tasks: readonly Task[],
    projects: readonly Project[],
    range: DashboardRange,
    now = new Date(),
): DashboardView {
    const completedTasks = tasks.filter((task) => task.completed);
    const activeProjects = projects.filter((project) => !project.completed);
    const completedProjects = projects.filter((project) => project.completed);
    const completionRate = percentage(completedTasks.length, tasks.length);
    const taskPeriod = periodComparison(tasks, now);
    const completedPeriod = periodComparison(completedTasks, now);
    const projectPeriod = periodComparison(activeProjects, now);
    const currentTaskCompletionRate = percentage(
        completedPeriod.current,
        taskPeriod.current,
    );
    const previousTaskCompletionRate = percentage(
        completedPeriod.previous,
        taskPeriod.previous,
    );

    return {
        metrics: [
            {
                key: 'tasks',
                title: 'Total tasks',
                value: tasks.length.toLocaleString(),
                trend: percentageChange(
                    taskPeriod.current,
                    taskPeriod.previous,
                ),
                trendLabel: `${taskPeriod.current.toLocaleString()} added in 30 days`,
                description: 'All locally available tasks',
            },
            {
                key: 'completed',
                title: 'Completed tasks',
                value: completedTasks.length.toLocaleString(),
                trend: percentageChange(
                    completedPeriod.current,
                    completedPeriod.previous,
                ),
                trendLabel: `${completionRate}% of tasks complete`,
                description: 'Progress across your task workspace',
            },
            {
                key: 'projects',
                title: 'Active projects',
                value: activeProjects.length.toLocaleString(),
                trend: percentageChange(
                    projectPeriod.current,
                    projectPeriod.previous,
                ),
                trendLabel: `${completedProjects.length.toLocaleString()} completed`,
                description: 'Projects currently in progress',
            },
            {
                key: 'completion',
                title: 'Completion rate',
                value: `${completionRate}%`,
                trend: currentTaskCompletionRate - previousTaskCompletionRate,
                trendLabel: `${completedTasks.length.toLocaleString()} of ${tasks.length.toLocaleString()} tasks`,
                description: 'Compared with the previous 30 days',
            },
        ],
        activity: buildActivitySeries(tasks, projects, range, now),
        workspaceItems: buildWorkspaceItems(tasks, projects),
        breakdown: [
            {
                key: 'completedTasks',
                label: 'Completed tasks',
                value: completedTasks.length,
                fill: 'var(--color-completedTasks)',
            },
            {
                key: 'openTasks',
                label: 'Open tasks',
                value: tasks.length - completedTasks.length,
                fill: 'var(--color-openTasks)',
            },
            {
                key: 'activeProjects',
                label: 'Active projects',
                value: activeProjects.length,
                fill: 'var(--color-activeProjects)',
            },
            {
                key: 'completedProjects',
                label: 'Completed projects',
                value: completedProjects.length,
                fill: 'var(--color-completedProjects)',
            },
        ],
        totalRecords: tasks.length + projects.length,
    };
}

export function buildWorkspaceItems(
    tasks: readonly Task[],
    projects: readonly Project[],
): DashboardWorkspaceItem[] {
    return [
        ...tasks.map((task): DashboardWorkspaceItem =>
            mapWorkspaceItem(task, 'task'),
        ),
        ...projects.map((project): DashboardWorkspaceItem =>
            mapWorkspaceItem(project, 'project'),
        ),
    ].sort(
        (first, second) =>
            new Date(second.updatedAt).getTime() -
            new Date(first.updatedAt).getTime(),
    );
}

export function buildActivitySeries(
    tasks: readonly Task[],
    projects: readonly Project[],
    range: DashboardRange,
    now = new Date(),
): DashboardActivityPoint[] {
    const activityByDate = new Map<
        string,
        { tasks: number; projects: number }
    >();

    for (const task of tasks) {
        incrementActivity(activityByDate, task.createdAt, 'tasks');
    }

    for (const project of projects) {
        incrementActivity(activityByDate, project.createdAt, 'projects');
    }

    return Array.from({ length: range }, (_, index) => {
        const date = startOfDay(now);
        date.setDate(date.getDate() - (range - index - 1));
        const dateKey = localDateKey(date);
        const activity = activityByDate.get(dateKey);

        return {
            date: dateKey,
            label: new Intl.DateTimeFormat(undefined, {
                month: 'short',
                day: 'numeric',
            }).format(date),
            tasks: activity?.tasks ?? 0,
            projects: activity?.projects ?? 0,
        };
    });
}

function mapWorkspaceItem(
    record: WorkspaceRecord,
    type: DashboardWorkspaceItem['type'],
): DashboardWorkspaceItem {
    return {
        id: record.id,
        title: record.title,
        type,
        status: record.completed ? 'completed' : 'open',
        syncStatus: record.syncStatus,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}

function incrementActivity(
    activityByDate: Map<string, { tasks: number; projects: number }>,
    createdAt: string,
    field: 'tasks' | 'projects',
): void {
    const date = new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
        return;
    }

    const dateKey = localDateKey(date);
    const activity = activityByDate.get(dateKey) ?? { tasks: 0, projects: 0 };
    activity[field] += 1;
    activityByDate.set(dateKey, activity);
}

function periodComparison(
    records: readonly WorkspaceRecord[],
    now: Date,
): { current: number; previous: number } {
    const today = startOfDay(now);
    const currentStart = new Date(today);
    currentStart.setDate(currentStart.getDate() - 29);
    const previousStart = new Date(today);
    previousStart.setDate(previousStart.getDate() - 59);

    return records.reduce(
        (counts, record) => {
            const createdAt = new Date(record.createdAt);

            if (createdAt >= currentStart) {
                counts.current += 1;
            } else if (createdAt >= previousStart) {
                counts.previous += 1;
            }

            return counts;
        },
        { current: 0, previous: 0 },
    );
}

function percentage(part: number, total: number): number {
    if (total === 0) {
        return 0;
    }

    return Math.round((part / total) * 100);
}

function percentageChange(current: number, previous: number): number {
    if (previous === 0) {
        return current === 0 ? 0 : 100;
    }

    return Math.round(((current - previous) / previous) * 100);
}

function startOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    return start;
}

function localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}
