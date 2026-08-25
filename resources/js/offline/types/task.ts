export type Task = {
    id: string;
    title: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
    version: number;
    syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
    deletedAt: string | null;
};

export type CreateTaskInput = {
    title: string;
    completed?: boolean;
};

export type UpdateTaskInput = {
    title?: string;
    completed?: boolean;
};
