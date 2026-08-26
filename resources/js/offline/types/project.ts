export type Project = {
    id: string;
    title: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
    version: number;
    syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
    deletedAt: string | null;
};

export type CreateProjectInput = {
    title: string;
    completed?: boolean;
};

export type UpdateProjectInput = {
    title?: string;
    completed?: boolean;
};
