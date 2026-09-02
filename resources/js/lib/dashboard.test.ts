import { describe, expect, it } from 'vitest';
import {
    buildActivitySeries,
    buildDashboardView,
    buildWorkspaceItems,
} from '@/lib/dashboard';
import type { Project } from '@/offline/types/project';
import type { Task } from '@/offline/types/task';

const now = new Date(2026, 8, 1, 12, 0, 0);

describe('dashboard data', () => {
    it('derives workspace metrics from locally available records', () => {
        const tasks = [
            task('task-today', 0, false, 'synced'),
            task('task-current-complete', 10, true, 'pending'),
            task('task-previous-complete', 40, true, 'synced'),
            task('task-old', 100, false, 'synced'),
        ];
        const projects = [
            project('project-current', 5, false, 'synced'),
            project('project-previous', 45, false, 'conflict'),
            project('project-complete', 100, true, 'synced'),
        ];

        const view = buildDashboardView(tasks, projects, 7, now);

        expect(view.metrics).toMatchObject([
            { key: 'tasks', value: '4', trend: 100 },
            { key: 'completed', value: '2', trend: 0 },
            { key: 'projects', value: '2', trend: 0 },
            { key: 'completion', value: '50%', trend: -50 },
        ]);
        expect(view.totalRecords).toBe(7);
        expect(
            view.breakdown.map(({ key, value }) => ({ key, value })),
        ).toEqual([
            { key: 'completedTasks', value: 2 },
            { key: 'openTasks', value: 2 },
            { key: 'activeProjects', value: 2 },
            { key: 'completedProjects', value: 1 },
        ]);
    });

    it('fills every date in the selected chart range, including empty days', () => {
        const activity = buildActivitySeries(
            [task('task-today', 0, false, 'synced')],
            [project('project-five-days-ago', 5, false, 'synced')],
            7,
            now,
        );

        expect(activity).toHaveLength(7);
        expect(activity.at(-1)).toMatchObject({ tasks: 1, projects: 0 });
        expect(activity.at(-6)).toMatchObject({ tasks: 0, projects: 1 });
        expect(
            activity.reduce(
                (sum, point) => sum + point.tasks + point.projects,
                0,
            ),
        ).toBe(2);
    });

    it('combines tasks and projects and orders them by latest update', () => {
        const olderTask = task('older-task', 2, false, 'pending');
        const newerProject = project('newer-project', 1, true, 'synced');

        const items = buildWorkspaceItems([olderTask], [newerProject]);

        expect(items).toMatchObject([
            {
                id: 'newer-project',
                type: 'project',
                status: 'completed',
            },
            { id: 'older-task', type: 'task', status: 'open' },
        ]);
    });

    it('returns safe zero-value metrics for an empty workspace', () => {
        const view = buildDashboardView([], [], 30, now);

        expect(view.metrics.map((metric) => metric.value)).toEqual([
            '0',
            '0',
            '0',
            '0%',
        ]);
        expect(view.metrics.every((metric) => metric.trend === 0)).toBe(true);
        expect(view.activity).toHaveLength(30);
    });
});

function task(
    id: string,
    daysAgo: number,
    completed: boolean,
    syncStatus: Task['syncStatus'],
): Task {
    const timestamp = timestampDaysAgo(daysAgo);

    return {
        id,
        title: id,
        completed,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
        syncStatus,
        deletedAt: null,
    };
}

function project(
    id: string,
    daysAgo: number,
    completed: boolean,
    syncStatus: Project['syncStatus'],
): Project {
    const timestamp = timestampDaysAgo(daysAgo);

    return {
        id,
        title: id,
        completed,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
        syncStatus,
        deletedAt: null,
    };
}

function timestampDaysAgo(daysAgo: number): string {
    const timestamp = new Date(now);
    timestamp.setDate(timestamp.getDate() - daysAgo);

    return timestamp.toISOString();
}
