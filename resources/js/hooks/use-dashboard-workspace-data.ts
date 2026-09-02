import { useEffect, useState } from 'react';
import { initializeDatabase } from '@/offline/database/database';
import { SqliteProjectRepository } from '@/offline/repositories/project-repository';
import { SqliteTaskRepository } from '@/offline/repositories/task-repository';
import type { Project } from '@/offline/types/project';
import type { Task } from '@/offline/types/task';

type DashboardWorkspaceData = {
    status: 'error' | 'loading' | 'ready';
    tasks: Task[];
    projects: Project[];
    error: string | null;
};

type DashboardWorkspaceDataOptions = {
    includeProjects: boolean;
    includeTasks: boolean;
    userScope: string | null;
};

const emptyData: DashboardWorkspaceData = {
    status: 'loading',
    tasks: [],
    projects: [],
    error: null,
};

export function useDashboardWorkspaceData({
    includeProjects,
    includeTasks,
    userScope,
}: DashboardWorkspaceDataOptions): DashboardWorkspaceData {
    const [data, setData] = useState<DashboardWorkspaceData>(emptyData);

    useEffect(() => {
        let cancelled = false;

        if (!userScope) {
            setData({
                status: 'ready',
                tasks: [],
                projects: [],
                error: null,
            });

            return;
        }

        const loadWorkspaceData = async (): Promise<void> => {
            try {
                const database = await initializeDatabase(userScope);
                const [tasks, projects] = await Promise.all([
                    includeTasks
                        ? new SqliteTaskRepository(database).all()
                        : Promise.resolve([]),
                    includeProjects
                        ? new SqliteProjectRepository(database).all()
                        : Promise.resolve([]),
                ]);

                if (!cancelled) {
                    setData({
                        status: 'ready',
                        tasks,
                        projects,
                        error: null,
                    });
                }
            } catch (error) {
                if (!cancelled) {
                    setData((currentData) => ({
                        ...currentData,
                        status: 'error',
                        error:
                            error instanceof Error
                                ? error.message
                                : 'The local workspace could not be loaded.',
                    }));
                }
            }
        };

        setData(emptyData);
        void loadWorkspaceData();

        const handleRefresh = (): void => {
            void loadWorkspaceData();
        };

        window.addEventListener('focus', handleRefresh);
        window.addEventListener('online', handleRefresh);

        return () => {
            cancelled = true;
            window.removeEventListener('focus', handleRefresh);
            window.removeEventListener('online', handleRefresh);
        };
    }, [includeProjects, includeTasks, userScope]);

    return data;
}
