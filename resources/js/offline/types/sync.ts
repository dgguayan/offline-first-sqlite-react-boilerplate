export type SyncOperation = 'create' | 'update' | 'delete';

export type ServerTaskRecord = {
    id: string;
    title: string;
    completed: boolean;
    version: number;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};

export type OutboxMutation = {
    id: string;
    entityType: 'task';
    entityId: string;
    operation: SyncOperation;
    payload: Omit<ServerTaskRecord, 'version'>;
    baseVersion: number | null;
    attempts: number;
};

export type SyncChange = {
    cursor: number;
    entity_type: 'task';
    entity_id: string;
    operation: 'upsert' | 'delete';
    version: number;
    record: ServerTaskRecord;
};

export type SyncConflict = {
    taskId: string;
    localRecord: ServerTaskRecord;
    serverRecord: ServerTaskRecord;
    serverVersion: number;
    createdAt: string;
};

export type SyncSummary = {
    pendingCount: number;
    conflictCount: number;
    rejectedCount: number;
};

export type PushAcceptedResult = {
    mutation_id: string;
    record: ServerTaskRecord;
};

export type PushConflictResult = {
    mutation_id: string;
    message: string;
    server_version: number;
    server_record: ServerTaskRecord;
};

export type PushRejectedResult = {
    mutation_id: string;
    message: string;
    retryable: boolean;
};

export type PushResponse = {
    accepted: PushAcceptedResult[];
    conflicts: PushConflictResult[];
    rejected: PushRejectedResult[];
};

export type PullResponse = {
    changes: SyncChange[];
    next_cursor: number;
    has_more: boolean;
};
