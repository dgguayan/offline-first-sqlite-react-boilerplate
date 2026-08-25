export type Task = {
    id: string;
    title: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
};

export type CreateTaskInput = {
    title: string;
    completed?: boolean;
};

export type UpdateTaskInput = {
    title?: string;
    completed?: boolean;
};
