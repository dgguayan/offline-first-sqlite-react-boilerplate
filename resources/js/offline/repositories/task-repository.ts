import type { LocalDatabase } from '@/offline/database/database';
import type {
    CreateTaskInput,
    Task,
    UpdateTaskInput,
} from '@/offline/types/task';

type TaskRow = {
    id: string;
    title: string;
    completed: number;
    created_at: string;
    updated_at: string;
    version: number;
    sync_status: Task['syncStatus'];
    deleted_at: string | null;
};

const taskColumns = `
    id, title, completed, created_at, updated_at,
    version, sync_status, deleted_at
`;

export interface TaskRepository {
    all(): Promise<Task[]>;
    find(id: string): Promise<Task | null>;
    create(input: CreateTaskInput): Promise<Task>;
    update(id: string, input: UpdateTaskInput): Promise<Task>;
    remove(id: string): Promise<void>;
    subscribe(listener: () => void): () => void;
    notifyExternalChange(): void;
}

export class SqliteTaskRepository implements TaskRepository {
    private readonly listeners = new Set<() => void>();

    public constructor(private readonly database: LocalDatabase) {}

    public async all(): Promise<Task[]> {
        const rows = await this.database.select<TaskRow>(`
            SELECT ${taskColumns}
            FROM tasks
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC
        `);

        return rows.map(mapTaskRow);
    }

    public async find(id: string): Promise<Task | null> {
        const rows = await this.database.select<TaskRow>(
            `
                SELECT ${taskColumns}
                FROM tasks
                WHERE id = ? AND deleted_at IS NULL
                LIMIT 1
            `,
            [id],
        );

        return rows[0] ? mapTaskRow(rows[0]) : null;
    }

    public async create(input: CreateTaskInput): Promise<Task> {
        const title = normalizeTitle(input.title);
        const now = new Date().toISOString();
        const task: Task = {
            id: crypto.randomUUID(),
            title,
            completed: input.completed ?? false,
            createdAt: now,
            updatedAt: now,
            version: 0,
            syncStatus: 'pending',
            deletedAt: null,
        };

        await this.database.transaction([
            {
                sql: `
                INSERT INTO tasks (
                    id, title, completed, created_at, updated_at,
                    version, sync_status, deleted_at
                ) VALUES (?, ?, ?, ?, ?, 0, 'pending', NULL)
            `,
                parameters: [
                    task.id,
                    task.title,
                    task.completed ? 1 : 0,
                    task.createdAt,
                    task.updatedAt,
                ],
            },
            createOutboxStatement(task, 'create', null, now),
        ]);
        this.notify();

        return task;
    }

    public async update(id: string, input: UpdateTaskInput): Promise<Task> {
        const existingTask = await this.find(id);

        if (!existingTask) {
            throw new Error(`Task ${id} was not found.`);
        }

        if (existingTask.syncStatus === 'conflict') {
            throw new Error(
                'Resolve this task’s sync conflict before editing it.',
            );
        }

        const task: Task = {
            ...existingTask,
            title:
                input.title === undefined
                    ? existingTask.title
                    : normalizeTitle(input.title),
            completed: input.completed ?? existingTask.completed,
            updatedAt: new Date().toISOString(),
        };

        await this.database.transaction([
            {
                sql: `
                UPDATE tasks
                SET title = ?,
                    completed = ?,
                    updated_at = ?,
                    sync_status = 'pending'
                WHERE id = ?
            `,
                parameters: [
                    task.title,
                    task.completed ? 1 : 0,
                    task.updatedAt,
                    task.id,
                ],
            },
            {
                sql: `
                    UPDATE sync_outbox
                    SET operation = CASE
                            WHEN operation = 'create' THEN 'create'
                            ELSE 'update'
                        END,
                        payload = ?,
                        base_version = CASE
                            WHEN operation = 'create' THEN NULL
                            ELSE ?
                        END,
                        updated_at = ?,
                        attempts = 0,
                        next_retry_at = NULL,
                        last_error = NULL
                    WHERE entity_type = 'task'
                        AND entity_id = ?
                        AND state = 'pending'
                `,
                parameters: [
                    serializeTask(task),
                    task.version,
                    task.updatedAt,
                    task.id,
                ],
            },
            {
                sql: `
                    INSERT INTO sync_outbox (
                        id, entity_type, entity_id, operation, payload,
                        base_version, state, created_at, updated_at
                    )
                    SELECT ?, 'task', ?, 'update', ?, ?, 'pending', ?, ?
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM sync_outbox
                        WHERE entity_type = 'task'
                            AND entity_id = ?
                            AND state = 'pending'
                    )
                `,
                parameters: [
                    crypto.randomUUID(),
                    task.id,
                    serializeTask(task),
                    task.version,
                    task.updatedAt,
                    task.updatedAt,
                    task.id,
                ],
            },
        ]);
        this.notify();

        return task;
    }

    public async remove(id: string): Promise<void> {
        const task = await this.find(id);

        if (!task) {
            return;
        }

        if (task.syncStatus === 'conflict') {
            throw new Error(
                'Resolve this task’s sync conflict before deleting it.',
            );
        }

        const deletedAt = new Date().toISOString();
        const deletedTask: Task = {
            ...task,
            updatedAt: deletedAt,
            deletedAt,
            syncStatus: 'pending',
        };

        await this.database.transaction([
            {
                sql: `
                    DELETE FROM tasks
                    WHERE id = ?
                        AND EXISTS (
                            SELECT 1
                            FROM sync_outbox
                            WHERE entity_type = 'task'
                                AND entity_id = tasks.id
                                AND operation = 'create'
                                AND state = 'pending'
                        )
                        AND NOT EXISTS (
                            SELECT 1
                            FROM sync_outbox
                            WHERE entity_type = 'task'
                                AND entity_id = tasks.id
                                AND state = 'in_flight'
                        )
                `,
                parameters: [id],
            },
            {
                sql: `
                    UPDATE tasks
                    SET deleted_at = ?,
                        updated_at = ?,
                        sync_status = 'pending'
                    WHERE id = ?
                `,
                parameters: [deletedAt, deletedAt, id],
            },
            {
                sql: `
                    UPDATE sync_outbox
                    SET operation = 'delete',
                        payload = ?,
                        base_version = ?,
                        updated_at = ?,
                        attempts = 0,
                        next_retry_at = NULL,
                        last_error = NULL
                    WHERE entity_type = 'task'
                        AND entity_id = ?
                        AND state = 'pending'
                `,
                parameters: [
                    serializeTask(deletedTask),
                    task.version,
                    deletedAt,
                    id,
                ],
            },
            {
                sql: `
                    INSERT INTO sync_outbox (
                        id, entity_type, entity_id, operation, payload,
                        base_version, state, created_at, updated_at
                    )
                    SELECT ?, 'task', ?, 'delete', ?, ?, 'pending', ?, ?
                    WHERE EXISTS (SELECT 1 FROM tasks WHERE id = ?)
                        AND NOT EXISTS (
                            SELECT 1
                            FROM sync_outbox
                            WHERE entity_type = 'task'
                                AND entity_id = ?
                                AND state = 'pending'
                        )
                `,
                parameters: [
                    crypto.randomUUID(),
                    id,
                    serializeTask(deletedTask),
                    task.version,
                    deletedAt,
                    deletedAt,
                    id,
                    id,
                ],
            },
        ]);
        this.notify();
    }

    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    public notifyExternalChange(): void {
        this.notify();
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}

function normalizeTitle(title: string): string {
    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
        throw new Error('A task title is required.');
    }

    if (normalizedTitle.length > 200) {
        throw new Error('A task title cannot exceed 200 characters.');
    }

    return normalizedTitle;
}

function mapTaskRow(row: TaskRow): Task {
    return {
        id: row.id,
        title: row.title,
        completed: row.completed === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        version: row.version,
        syncStatus: row.sync_status,
        deletedAt: row.deleted_at,
    };
}

function serializeTask(task: Task): string {
    return JSON.stringify({
        id: task.id,
        title: task.title,
        completed: task.completed,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
        deleted_at: task.deletedAt,
    });
}

function createOutboxStatement(
    task: Task,
    operation: 'create' | 'update' | 'delete',
    baseVersion: number | null,
    now: string,
) {
    return {
        sql: `
            INSERT INTO sync_outbox (
                id, entity_type, entity_id, operation, payload,
                base_version, state, created_at, updated_at
            ) VALUES (?, 'task', ?, ?, ?, ?, 'pending', ?, ?)
        `,
        parameters: [
            crypto.randomUUID(),
            task.id,
            operation,
            serializeTask(task),
            baseVersion,
            now,
            now,
        ],
    } as const;
}
