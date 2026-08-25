import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    initializeDatabase,
    rememberActiveOfflineUser,
} from '@/offline/database/database';
import { SqliteSyncRepository } from '@/offline/repositories/sync-repository';
import { SqliteTaskRepository } from '@/offline/repositories/task-repository';
import type { TaskRepository } from '@/offline/repositories/task-repository';
import { SyncEngine } from '@/offline/sync/sync-engine';
import type { SyncState } from '@/offline/sync/sync-engine';
import { useSyncState } from '@/offline/sync/use-sync-state';
import type { SyncConflict } from '@/offline/types/sync';
import type { Task } from '@/offline/types/task';

type Props = {
    userScope: string;
    rememberUserScope?: boolean;
};

type WorkspaceState =
    | { status: 'loading' }
    | {
          status: 'ready';
          repository: TaskRepository;
          syncRepository: SqliteSyncRepository;
          syncEngine: SyncEngine;
          sqliteVersion: string;
          persistentStorageGranted: boolean;
      }
    | { status: 'error'; message: string };

export function TaskWorkspace({ userScope, rememberUserScope = false }: Props) {
    const [workspace, setWorkspace] = useState<WorkspaceState>({
        status: 'loading',
    });
    const [tasks, setTasks] = useState<Task[]>([]);
    const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
    const [title, setTitle] = useState('');
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const syncEngine =
        workspace.status === 'ready' ? workspace.syncEngine : null;
    const syncState = useSyncState(syncEngine);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: () => void = () => undefined;
        let engine: SyncEngine | null = null;

        if (rememberUserScope) {
            rememberActiveOfflineUser(userScope);
        }

        void initializeDatabase(userScope)
            .then(async (database) => {
                const repository = new SqliteTaskRepository(database);
                const syncRepository = new SqliteSyncRepository(database, () =>
                    repository.notifyExternalChange(),
                );
                engine = new SyncEngine(syncRepository);

                const reloadTasks = async () => {
                    const localTasks = await repository.all();

                    if (!cancelled) {
                        setTasks(localTasks);
                    }
                };

                await reloadTasks();

                if (cancelled) {
                    engine.stop();

                    return;
                }

                unsubscribe = repository.subscribe(() => {
                    void reloadTasks().catch((repositoryError: unknown) => {
                        setError(errorMessage(repositoryError));
                    });
                });
                const info = database.info();
                setWorkspace({
                    status: 'ready',
                    repository,
                    syncRepository,
                    syncEngine: engine,
                    sqliteVersion: info.sqliteVersion,
                    persistentStorageGranted: info.persistentStorageGranted,
                });
                void engine.start().catch((syncError: unknown) => {
                    if (!cancelled) {
                        setError(errorMessage(syncError));
                    }
                });
            })
            .catch((databaseError: unknown) => {
                if (!cancelled) {
                    setWorkspace({
                        status: 'error',
                        message: errorMessage(databaseError),
                    });
                }
            });

        return () => {
            cancelled = true;
            unsubscribe();
            engine?.stop();
        };
    }, [rememberUserScope, userScope]);

    useEffect(() => {
        if (workspace.status !== 'ready') {
            return;
        }

        void workspace.syncRepository
            .conflicts()
            .then(setConflicts)
            .catch((conflictError: unknown) => {
                setError(errorMessage(conflictError));
            });
    }, [syncState.conflictCount, syncState.lastSyncedAt, workspace]);

    const repository =
        workspace.status === 'ready' ? workspace.repository : null;

    const runMutation = async (mutation: () => Promise<void>) => {
        setSaving(true);
        setError(null);

        try {
            await mutation();
            await syncEngine?.localDataChanged();
        } catch (mutationError) {
            setError(errorMessage(mutationError));
        } finally {
            setSaving(false);
        }
    };

    const createTask = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!repository) {
            return;
        }

        await runMutation(async () => {
            await repository.create({ title });
            setTitle('');
        });
    };

    const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!repository || !editingTask) {
            return;
        }

        await runMutation(async () => {
            await repository.update(editingTask.id, {
                title: editingTask.title,
            });
            setEditingTask(null);
        });
    };

    const updateCompleted = (task: Task, completed: boolean): void => {
        if (repository) {
            void runMutation(() =>
                repository.update(task.id, { completed }).then(() => undefined),
            );
        }
    };

    const removeTask = (task: Task): void => {
        if (repository) {
            void runMutation(() => repository.remove(task.id));
        }
    };

    const resolveConflict = (
        conflict: SyncConflict,
        resolution: 'server' | 'local',
    ): void => {
        if (workspace.status !== 'ready') {
            return;
        }

        void runMutation(async () => {
            if (resolution === 'server') {
                await workspace.syncRepository.useServerVersion(
                    conflict.taskId,
                );
            } else {
                await workspace.syncRepository.keepLocalVersion(
                    conflict.taskId,
                );
            }
        });
    };

    return (
        <Card className="mx-auto w-full max-w-3xl">
            <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <CardTitle>Offline-first tasks</CardTitle>
                        <CardDescription className="mt-1">
                            Every edit is written directly to browser SQLite.
                            Laravel syncs in the background whenever it is
                            reachable.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={syncStatusClass(syncState.phase)}>
                            {syncStatusLabel(syncState)}
                        </span>
                        {workspace.status === 'ready' && (
                            <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                aria-label="Sync now"
                                disabled={syncState.phase === 'syncing'}
                                onClick={() =>
                                    void workspace.syncEngine.syncNow()
                                }
                            >
                                <RefreshCw
                                    className={
                                        syncState.phase === 'syncing'
                                            ? 'animate-spin'
                                            : ''
                                    }
                                />
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                {workspace.status === 'loading' && (
                    <p className="text-sm text-muted-foreground">
                        Opening the local SQLite database…
                    </p>
                )}

                {workspace.status === 'error' && (
                    <div
                        className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
                        role="alert"
                    >
                        <p className="font-medium">
                            Local database unavailable
                        </p>
                        <p className="mt-1 text-muted-foreground">
                            {workspace.message}
                        </p>
                    </div>
                )}

                {workspace.status === 'ready' && (
                    <>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>SQLite {workspace.sqliteVersion}</span>
                            <span>Storage: OPFS</span>
                            <span>
                                Eviction protection:{' '}
                                {workspace.persistentStorageGranted
                                    ? 'granted'
                                    : 'browser managed'}
                            </span>
                            <span>Queue: {syncState.pendingCount} pending</span>
                            {syncState.lastSyncedAt && (
                                <span>
                                    Last sync:{' '}
                                    {new Date(
                                        syncState.lastSyncedAt,
                                    ).toLocaleTimeString()}
                                </span>
                            )}
                        </div>

                        <form className="flex gap-2" onSubmit={createTask}>
                            <Input
                                value={title}
                                onChange={(event) =>
                                    setTitle(event.target.value)
                                }
                                maxLength={200}
                                placeholder="What needs to be done?"
                                aria-label="New task title"
                            />
                            <Button
                                type="submit"
                                disabled={saving || !title.trim()}
                            >
                                <Plus />
                                Add
                            </Button>
                        </form>

                        {error && (
                            <p
                                className="text-sm text-destructive"
                                role="alert"
                            >
                                {error}
                            </p>
                        )}

                        {syncState.lastError &&
                            syncState.phase !== 'offline' &&
                            !error && (
                                <p className="text-sm text-amber-700 dark:text-amber-300">
                                    {syncState.lastError} Local edits remain
                                    safe and will retry automatically.
                                </p>
                            )}

                        <div className="space-y-2">
                            {tasks.length === 0 && (
                                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                                    Create a task online or offline. Browser
                                    SQLite remains the immediate source of
                                    truth.
                                </div>
                            )}

                            {tasks.map((task) => (
                                <div
                                    key={task.id}
                                    className="flex items-center gap-3 rounded-lg border p-3"
                                >
                                    <Checkbox
                                        checked={task.completed}
                                        aria-label={`Mark ${task.title} as ${task.completed ? 'incomplete' : 'complete'}`}
                                        disabled={
                                            saving ||
                                            task.syncStatus === 'conflict'
                                        }
                                        onCheckedChange={(checked) =>
                                            updateCompleted(
                                                task,
                                                checked === true,
                                            )
                                        }
                                    />
                                    <span
                                        className={`min-w-0 flex-1 text-sm break-words ${
                                            task.completed
                                                ? 'text-muted-foreground line-through'
                                                : ''
                                        }`}
                                    >
                                        {task.title}
                                    </span>
                                    {task.syncStatus !== 'synced' && (
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                            {task.syncStatus}
                                        </span>
                                    )}
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={`Edit ${task.title}`}
                                        disabled={
                                            saving ||
                                            task.syncStatus === 'conflict'
                                        }
                                        onClick={() => setEditingTask(task)}
                                    >
                                        <Pencil />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={`Delete ${task.title}`}
                                        disabled={
                                            saving ||
                                            task.syncStatus === 'conflict'
                                        }
                                        onClick={() => removeTask(task)}
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        {conflicts.length > 0 && (
                            <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                                <div>
                                    <h2 className="text-sm font-semibold">
                                        Sync conflicts need your choice
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        Neither version was overwritten
                                        automatically.
                                    </p>
                                </div>
                                {conflicts.map((conflict) => (
                                    <div
                                        key={conflict.taskId}
                                        className="rounded-md border bg-background p-3"
                                    >
                                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                                            <div>
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    This device
                                                </span>
                                                <p>
                                                    {conflict.localRecord.title}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    Server
                                                </span>
                                                <p>
                                                    {
                                                        conflict.serverRecord
                                                            .title
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={saving}
                                                onClick={() =>
                                                    resolveConflict(
                                                        conflict,
                                                        'server',
                                                    )
                                                }
                                            >
                                                Use server
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                disabled={saving}
                                                onClick={() =>
                                                    resolveConflict(
                                                        conflict,
                                                        'local',
                                                    )
                                                }
                                            >
                                                Keep mine
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </CardContent>

            {editingTask && repository && (
                <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4">
                    <form
                        className="w-full max-w-md rounded-xl border bg-background p-5 shadow-xl"
                        onSubmit={saveEdit}
                    >
                        <h2 className="font-semibold">Edit task</h2>
                        <Input
                            className="mt-4"
                            value={editingTask.title}
                            maxLength={200}
                            autoFocus
                            onChange={(event) =>
                                setEditingTask({
                                    ...editingTask,
                                    title: event.target.value,
                                })
                            }
                        />
                        <div className="mt-4 flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setEditingTask(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={saving || !editingTask.title.trim()}
                            >
                                Save
                            </Button>
                        </div>
                    </form>
                </div>
            )}
        </Card>
    );
}

function errorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : 'An unexpected local database error occurred.';
}

function syncStatusLabel(state: SyncState): string {
    if (state.phase === 'syncing') {
        return `Syncing · ${state.pendingCount} queued`;
    }

    if (state.phase === 'auth-required') {
        return 'Sign in again to sync';
    }

    if (state.phase === 'offline') {
        return state.pendingCount > 0
            ? `${state.pendingCount} queued`
            : 'Synced';
    }

    if (state.phase === 'error') {
        return `Sync error · ${state.rejectedCount} rejected`;
    }

    if (state.conflictCount > 0) {
        return `${state.conflictCount} conflict${state.conflictCount === 1 ? '' : 's'}`;
    }

    return state.pendingCount > 0 ? `${state.pendingCount} queued` : 'Synced';
}

function syncStatusClass(phase: SyncState['phase']): string {
    const color =
        phase === 'idle' || phase === 'offline'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';

    return `rounded-full px-3 py-1 text-xs font-medium ${color}`;
}
