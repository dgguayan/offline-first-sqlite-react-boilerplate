import { Pencil, Plus, Trash2 } from 'lucide-react';
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
import { SqliteTaskRepository } from '@/offline/repositories/task-repository';
import type { TaskRepository } from '@/offline/repositories/task-repository';
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
          sqliteVersion: string;
          persistentStorageGranted: boolean;
      }
    | { status: 'error'; message: string };

export function TaskWorkspace({ userScope, rememberUserScope = false }: Props) {
    const [workspace, setWorkspace] = useState<WorkspaceState>({
        status: 'loading',
    });
    const [tasks, setTasks] = useState<Task[]>([]);
    const [title, setTitle] = useState('');
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [networkAvailable, setNetworkAvailable] = useState(
        typeof navigator === 'undefined' ? true : navigator.onLine,
    );

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: () => void = () => undefined;

        if (rememberUserScope) {
            rememberActiveOfflineUser(userScope);
        }

        void initializeDatabase(userScope)
            .then(async (database) => {
                const repository = new SqliteTaskRepository(database);

                const reloadTasks = async () => {
                    const localTasks = await repository.all();

                    if (!cancelled) {
                        setTasks(localTasks);
                    }
                };

                await reloadTasks();

                if (cancelled) {
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
                    sqliteVersion: info.sqliteVersion,
                    persistentStorageGranted: info.persistentStorageGranted,
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
        };
    }, [rememberUserScope, userScope]);

    useEffect(() => {
        const updateNetworkAvailability = () => {
            setNetworkAvailable(navigator.onLine);
        };

        window.addEventListener('online', updateNetworkAvailability);
        window.addEventListener('offline', updateNetworkAvailability);

        return () => {
            window.removeEventListener('online', updateNetworkAvailability);
            window.removeEventListener('offline', updateNetworkAvailability);
        };
    }, []);

    const repository =
        workspace.status === 'ready' ? workspace.repository : null;

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

    const runMutation = async (mutation: () => Promise<void>) => {
        setSaving(true);
        setError(null);

        try {
            await mutation();
        } catch (mutationError) {
            setError(errorMessage(mutationError));
        } finally {
            setSaving(false);
        }
    };

    const updateCompleted = (task: Task, completed: boolean): void => {
        if (!repository) {
            return;
        }

        void runMutation(() =>
            repository.update(task.id, { completed }).then(() => undefined),
        );
    };

    const removeTask = (task: Task): void => {
        if (!repository) {
            return;
        }

        void runMutation(() => repository.remove(task.id));
    };

    return (
        <Card className="mx-auto w-full max-w-3xl">
            <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <CardTitle>Local tasks</CardTitle>
                        <CardDescription className="mt-1">
                            Every edit is written directly to browser SQLite.
                            Server sync is intentionally not part of this
                            milestone.
                        </CardDescription>
                    </div>
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                            networkAvailable
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                        }`}
                    >
                        {networkAvailable
                            ? 'Network available'
                            : 'Offline · local edits enabled'}
                    </span>
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

                        <div className="space-y-2">
                            {tasks.length === 0 && (
                                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                                    Create a task, then reload or reopen the
                                    browser to prove OPFS persistence.
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
                                        disabled={saving}
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
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={`Edit ${task.title}`}
                                        disabled={saving}
                                        onClick={() => setEditingTask(task)}
                                    >
                                        <Pencil />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={`Delete ${task.title}`}
                                        disabled={saving}
                                        onClick={() => removeTask(task)}
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                            ))}
                        </div>
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
