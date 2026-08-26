import type { LocalDatabase } from '@/offline/database/database';
import type {
    CreateProjectInput,
    Project,
    UpdateProjectInput,
} from '@/offline/types/project';

type ProjectRow = {
    id: string;
    title: string;
    completed: number;
    created_at: string;
    updated_at: string;
    version: number;
    sync_status: Project['syncStatus'];
    deleted_at: string | null;
};

const projectColumns = `
    id, title, completed, created_at, updated_at,
    version, sync_status, deleted_at
`;

export interface ProjectRepository {
    all(): Promise<Project[]>;
    find(id: string): Promise<Project | null>;
    create(input: CreateProjectInput): Promise<Project>;
    update(id: string, input: UpdateProjectInput): Promise<Project>;
    remove(id: string): Promise<void>;
    subscribe(listener: () => void): () => void;
    notifyExternalChange(): void;
}

export class SqliteProjectRepository implements ProjectRepository {
    private readonly listeners = new Set<() => void>();

    public constructor(private readonly database: LocalDatabase) {}

    public async all(): Promise<Project[]> {
        const rows = await this.database.select<ProjectRow>(`
            SELECT ${projectColumns}
            FROM projects
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC
        `);

        return rows.map(mapProjectRow);
    }

    public async find(id: string): Promise<Project | null> {
        const rows = await this.database.select<ProjectRow>(
            `
                SELECT ${projectColumns}
                FROM projects
                WHERE id = ? AND deleted_at IS NULL
                LIMIT 1
            `,
            [id],
        );

        return rows[0] ? mapProjectRow(rows[0]) : null;
    }

    public async create(input: CreateProjectInput): Promise<Project> {
        const title = normalizeTitle(input.title);
        const now = new Date().toISOString();
        const project: Project = {
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
                INSERT INTO projects (
                    id, title, completed, created_at, updated_at,
                    version, sync_status, deleted_at
                ) VALUES (?, ?, ?, ?, ?, 0, 'pending', NULL)
            `,
                parameters: [
                    project.id,
                    project.title,
                    project.completed ? 1 : 0,
                    project.createdAt,
                    project.updatedAt,
                ],
            },
            createOutboxStatement(project, 'create', null, now),
        ]);
        this.notify();

        return project;
    }

    public async update(
        id: string,
        input: UpdateProjectInput,
    ): Promise<Project> {
        const existingProject = await this.find(id);

        if (!existingProject) {
            throw new Error(`Project ${id} was not found.`);
        }

        if (existingProject.syncStatus === 'conflict') {
            throw new Error(
                'Resolve this project’s sync conflict before editing it.',
            );
        }

        const project: Project = {
            ...existingProject,
            title:
                input.title === undefined
                    ? existingProject.title
                    : normalizeTitle(input.title),
            completed: input.completed ?? existingProject.completed,
            updatedAt: new Date().toISOString(),
        };

        await this.database.transaction([
            {
                sql: `
                UPDATE projects
                SET title = ?,
                    completed = ?,
                    updated_at = ?,
                    sync_status = 'pending'
                WHERE id = ?
            `,
                parameters: [
                    project.title,
                    project.completed ? 1 : 0,
                    project.updatedAt,
                    project.id,
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
                    WHERE entity_type = 'project'
                        AND entity_id = ?
                        AND state = 'pending'
                `,
                parameters: [
                    serializeProject(project),
                    project.version,
                    project.updatedAt,
                    project.id,
                ],
            },
            {
                sql: `
                    INSERT INTO sync_outbox (
                        id, entity_type, entity_id, operation, payload,
                        base_version, state, created_at, updated_at
                    )
                    SELECT ?, 'project', ?, 'update', ?, ?, 'pending', ?, ?
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM sync_outbox
                        WHERE entity_type = 'project'
                            AND entity_id = ?
                            AND state = 'pending'
                    )
                `,
                parameters: [
                    crypto.randomUUID(),
                    project.id,
                    serializeProject(project),
                    project.version,
                    project.updatedAt,
                    project.updatedAt,
                    project.id,
                ],
            },
        ]);
        this.notify();

        return project;
    }

    public async remove(id: string): Promise<void> {
        const project = await this.find(id);

        if (!project) {
            return;
        }

        if (project.syncStatus === 'conflict') {
            throw new Error(
                'Resolve this project’s sync conflict before deleting it.',
            );
        }

        const deletedAt = new Date().toISOString();
        const deletedProject: Project = {
            ...project,
            updatedAt: deletedAt,
            deletedAt,
            syncStatus: 'pending',
        };

        await this.database.transaction([
            {
                sql: `
                    DELETE FROM projects
                    WHERE id = ?
                        AND EXISTS (
                            SELECT 1
                            FROM sync_outbox
                            WHERE entity_type = 'project'
                                AND entity_id = projects.id
                                AND operation = 'create'
                                AND state = 'pending'
                        )
                        AND NOT EXISTS (
                            SELECT 1
                            FROM sync_outbox
                            WHERE entity_type = 'project'
                                AND entity_id = projects.id
                                AND state = 'in_flight'
                        )
                `,
                parameters: [id],
            },
            {
                sql: `
                    DELETE FROM sync_outbox
                    WHERE entity_type = 'project'
                        AND entity_id = ?
                        AND operation = 'create'
                        AND state = 'pending'
                        AND NOT EXISTS (
                            SELECT 1 FROM projects WHERE id = ?
                        )
                `,
                parameters: [id, id],
            },
            {
                sql: `
                    UPDATE projects
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
                    WHERE entity_type = 'project'
                        AND entity_id = ?
                        AND state = 'pending'
                `,
                parameters: [
                    serializeProject(deletedProject),
                    project.version,
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
                    SELECT ?, 'project', ?, 'delete', ?, ?, 'pending', ?, ?
                    WHERE EXISTS (SELECT 1 FROM projects WHERE id = ?)
                        AND NOT EXISTS (
                            SELECT 1
                            FROM sync_outbox
                            WHERE entity_type = 'project'
                                AND entity_id = ?
                                AND state = 'pending'
                        )
                `,
                parameters: [
                    crypto.randomUUID(),
                    id,
                    serializeProject(deletedProject),
                    project.version,
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
        throw new Error('A project title is required.');
    }

    if (normalizedTitle.length > 200) {
        throw new Error('A project title cannot exceed 200 characters.');
    }

    return normalizedTitle;
}

function mapProjectRow(row: ProjectRow): Project {
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

function serializeProject(project: Project): string {
    return JSON.stringify({
        id: project.id,
        title: project.title,
        completed: project.completed,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
        deleted_at: project.deletedAt,
    });
}

function createOutboxStatement(
    project: Project,
    operation: 'create' | 'update' | 'delete',
    baseVersion: number | null,
    now: string,
) {
    return {
        sql: `
            INSERT INTO sync_outbox (
                id, entity_type, entity_id, operation, payload,
                base_version, state, created_at, updated_at
            ) VALUES (?, 'project', ?, ?, ?, ?, 'pending', ?, ?)
        `,
        parameters: [
            crypto.randomUUID(),
            project.id,
            operation,
            serializeProject(project),
            baseVersion,
            now,
            now,
        ],
    } as const;
}
