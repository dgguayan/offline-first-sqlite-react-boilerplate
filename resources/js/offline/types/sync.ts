export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncEntityType = 'task' | 'project';

export type ServerEntityRecord = {
    id: string;
    title: string;
    completed: boolean;
    version: number;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};

export type ServerTaskRecord = ServerEntityRecord;

export type ServerProjectRecord = ServerEntityRecord;

export type OutboxMutation = {
    id: string;
    entityType: SyncEntityType;
    entityId: string;
    operation: SyncOperation;
    payload: Omit<ServerEntityRecord, 'version'>;
    baseVersion: number | null;
    attempts: number;
};

export type SyncChange = {
    cursor: number;
    entity_type: SyncEntityType;
    entity_id: string;
    operation: 'upsert' | 'delete' | 'restore';
    version: number;
    record: ServerEntityRecord;
};

export type SyncConflict = {
    entityType: SyncEntityType;
    entityId: string;
    localRecord: ServerEntityRecord;
    serverRecord: ServerEntityRecord;
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
    record: ServerEntityRecord;
};

export type PushConflictResult = {
    mutation_id: string;
    message: string;
    server_version: number;
    server_record: ServerEntityRecord;
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
