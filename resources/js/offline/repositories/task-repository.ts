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
};

export interface TaskRepository {
    all(): Promise<Task[]>;
    find(id: string): Promise<Task | null>;
    create(input: CreateTaskInput): Promise<Task>;
    update(id: string, input: UpdateTaskInput): Promise<Task>;
    remove(id: string): Promise<void>;
    subscribe(listener: () => void): () => void;
}

export class SqliteTaskRepository implements TaskRepository {
    private readonly listeners = new Set<() => void>();

    public constructor(private readonly database: LocalDatabase) {}

    public async all(): Promise<Task[]> {
        const rows = await this.database.select<TaskRow>(`
            SELECT id, title, completed, created_at, updated_at
            FROM tasks
            ORDER BY created_at DESC
        `);

        return rows.map(mapTaskRow);
    }

    public async find(id: string): Promise<Task | null> {
        const rows = await this.database.select<TaskRow>(
            `
                SELECT id, title, completed, created_at, updated_at
                FROM tasks
                WHERE id = ?
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
        };

        await this.database.execute(
            `
                INSERT INTO tasks (
                    id, title, completed, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?)
            `,
            [
                task.id,
                task.title,
                task.completed ? 1 : 0,
                task.createdAt,
                task.updatedAt,
            ],
        );
        this.notify();

        return task;
    }

    public async update(id: string, input: UpdateTaskInput): Promise<Task> {
        const existingTask = await this.find(id);

        if (!existingTask) {
            throw new Error(`Task ${id} was not found.`);
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

        await this.database.execute(
            `
                UPDATE tasks
                SET title = ?, completed = ?, updated_at = ?
                WHERE id = ?
            `,
            [task.title, task.completed ? 1 : 0, task.updatedAt, task.id],
        );
        this.notify();

        return task;
    }

    public async remove(id: string): Promise<void> {
        await this.database.execute('DELETE FROM tasks WHERE id = ?', [id]);
        this.notify();
    }

    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
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
    };
}
