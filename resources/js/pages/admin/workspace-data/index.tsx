import { Head, router, usePage } from '@inertiajs/react';
import {
    Archive,
    Database,
    FolderKanban,
    ListTodo,
    RotateCcw,
    Search,
} from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import { Pagination } from '@/components/admin/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
    archive as archiveWorkspaceRecord,
    index,
    restore as restoreWorkspaceRecord,
} from '@/routes/admin/workspace-data';
import type { Auth, Paginated } from '@/types';

type RecordType = 'tasks' | 'projects';

type WorkspaceRecord = {
    id: string;
    user_id: number;
    title: string;
    completed: boolean | number;
    version: number;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
    owner_name: string;
    owner_email: string;
};

type Filters = {
    type: RecordType;
    search: string;
    status: string;
    sort: string;
    direction: 'asc' | 'desc';
};

type Props = {
    records: Paginated<WorkspaceRecord>;
    counts: {
        tasks: number;
        projects: number;
    };
    filters: Filters;
};

export default function WorkspaceData({ records, counts, filters }: Props) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const [values, setValues] = useState(filters);
    const [processingKey, setProcessingKey] = useState<string | null>(null);
    const canArchive = 'workspace.archive-any' in auth.permissions;
    const canRestore = 'workspace.restore-any' in auth.permissions;
    const canManageArchive = canArchive || canRestore;

    const visit = (nextValues: Filters): void => {
        setValues(nextValues);
        router.get(index(), nextValues, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const selectType = (type: RecordType): void => {
        visit({ ...values, type });
    };

    const changeArchiveState = (
        record: WorkspaceRecord,
        action: 'archive' | 'restore',
    ): void => {
        const key = `${action}:${record.id}`;
        const destination =
            action === 'archive'
                ? archiveWorkspaceRecord({
                      type: values.type,
                      id: record.id,
                  })
                : restoreWorkspaceRecord({
                      type: values.type,
                      id: record.id,
                  });

        setProcessingKey(key);
        router.patch(
            destination,
            {},
            {
                preserveScroll: true,
                onFinish: () => setProcessingKey(null),
            },
        );
    };

    const entityLabel = values.type === 'tasks' ? 'task' : 'project';

    return (
        <>
            <Head title="Workspace data" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <AdminPageHeader
                    title="Workspace data"
                    description={
                        canManageArchive
                            ? 'View tasks and projects belonging to every user. Archive and restore actions are synchronized and audited.'
                            : 'View tasks and projects belonging to every user. This administration view is read-only.'
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2">
                    <SummaryCard
                        title="Tasks"
                        count={counts.tasks}
                        icon={ListTodo}
                        active={values.type === 'tasks'}
                        onClick={() => selectType('tasks')}
                    />
                    <SummaryCard
                        title="Projects"
                        count={counts.projects}
                        icon={FolderKanban}
                        active={values.type === 'projects'}
                        onClick={() => selectType('projects')}
                    />
                </div>

                <Card className="gap-0 overflow-hidden py-0">
                    <form
                        className="grid gap-3 border-b p-4 md:grid-cols-[minmax(240px,1fr)_180px_180px_150px_auto]"
                        onSubmit={(event) => {
                            event.preventDefault();
                            visit(values);
                        }}
                    >
                        <div className="relative">
                            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                            <Input
                                value={values.search}
                                onChange={(event) =>
                                    setValues({
                                        ...values,
                                        search: event.target.value,
                                    })
                                }
                                className="pl-9"
                                placeholder={`Search ${values.type} or owners...`}
                                aria-label={`Search ${values.type}`}
                            />
                        </div>
                        <select
                            value={values.status}
                            onChange={(event) =>
                                setValues({
                                    ...values,
                                    status: event.target.value,
                                })
                            }
                            className="h-9 rounded-md border bg-background px-3 text-sm"
                            aria-label="Filter by status"
                        >
                            <option value="">All statuses</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="incomplete">Incomplete</option>
                            <option value="archived">Archived</option>
                        </select>
                        <select
                            value={values.sort}
                            onChange={(event) =>
                                setValues({
                                    ...values,
                                    sort: event.target.value,
                                })
                            }
                            className="h-9 rounded-md border bg-background px-3 text-sm"
                            aria-label="Sort records"
                        >
                            <option value="updated_at">Last updated</option>
                            <option value="created_at">Date created</option>
                            <option value="title">Title</option>
                            <option value="owner">Owner</option>
                            <option value="completed">Completion</option>
                        </select>
                        <select
                            value={values.direction}
                            onChange={(event) =>
                                setValues({
                                    ...values,
                                    direction: event.target.value as
                                        'asc' | 'desc',
                                })
                            }
                            className="h-9 rounded-md border bg-background px-3 text-sm"
                            aria-label="Sort direction"
                        >
                            <option value="desc">Descending</option>
                            <option value="asc">Ascending</option>
                        </select>
                        <Button variant="secondary">Apply</Button>
                    </form>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-4 py-3">Title</th>
                                    <th className="px-4 py-3">Owner</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Version</th>
                                    <th className="px-4 py-3">Created</th>
                                    <th className="px-4 py-3">Updated</th>
                                    {canManageArchive && (
                                        <th className="px-4 py-3 text-right">
                                            Action
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {records.data.map((record) => (
                                    <tr
                                        key={record.id}
                                        className="align-top hover:bg-muted/30"
                                    >
                                        <td className="min-w-64 px-4 py-4">
                                            <div className="font-medium break-words">
                                                {record.title}
                                            </div>
                                            <code className="text-xs text-muted-foreground">
                                                {record.id}
                                            </code>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-medium whitespace-nowrap">
                                                {record.owner_name}
                                            </div>
                                            <div className="text-xs whitespace-nowrap text-muted-foreground">
                                                {record.owner_email}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <RecordStatus record={record} />
                                        </td>
                                        <td className="px-4 py-4 text-muted-foreground">
                                            {record.version}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                                            {formatDate(record.created_at)}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                                            {formatDate(record.updated_at)}
                                        </td>
                                        {canManageArchive && (
                                            <td className="px-4 py-4 text-right">
                                                {!record.archived_at &&
                                                    canArchive && (
                                                        <ConfirmActionDialog
                                                            trigger={
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                >
                                                                    <Archive />{' '}
                                                                    Archive
                                                                </Button>
                                                            }
                                                            title={`Archive this ${entityLabel}?`}
                                                            description={`"${record.title}" belongs to ${record.owner_name}. It will be hidden from the owner's workspace during synchronization and can be restored later.`}
                                                            confirmLabel={`Archive ${entityLabel}`}
                                                            processing={
                                                                processingKey ===
                                                                `archive:${record.id}`
                                                            }
                                                            onConfirm={() =>
                                                                changeArchiveState(
                                                                    record,
                                                                    'archive',
                                                                )
                                                            }
                                                        />
                                                    )}
                                                {record.archived_at &&
                                                    canRestore && (
                                                        <ConfirmActionDialog
                                                            trigger={
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                >
                                                                    <RotateCcw />{' '}
                                                                    Restore
                                                                </Button>
                                                            }
                                                            title={`Restore this ${entityLabel}?`}
                                                            description={`"${record.title}" will return to ${record.owner_name}'s workspace during the next synchronization.`}
                                                            confirmLabel={`Restore ${entityLabel}`}
                                                            processing={
                                                                processingKey ===
                                                                `restore:${record.id}`
                                                            }
                                                            onConfirm={() =>
                                                                changeArchiveState(
                                                                    record,
                                                                    'restore',
                                                                )
                                                            }
                                                        />
                                                    )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {records.data.length === 0 && (
                        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                            <Database className="size-8 text-muted-foreground" />
                            <p className="font-medium">
                                No {values.type} found
                            </p>
                            <p className="text-sm text-muted-foreground">
                                No {entityLabel} records match the current
                                search and filters.
                            </p>
                        </div>
                    )}

                    <Pagination
                        links={records.links}
                        from={records.from}
                        to={records.to}
                        total={records.total}
                    />
                </Card>
            </div>
        </>
    );
}

function SummaryCard({
    title,
    count,
    icon: Icon,
    active,
    onClick,
}: {
    title: string;
    count: number;
    icon: typeof ListTodo;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex items-center gap-4 rounded-xl border bg-card p-5 text-left shadow-sm transition-colors hover:bg-muted/40',
                active && 'border-primary ring-1 ring-primary/20',
            )}
        >
            <span className="rounded-lg bg-muted p-3">
                <Icon className="size-5" />
            </span>
            <span>
                <span className="block text-sm text-muted-foreground">
                    {title}
                </span>
                <span className="block text-2xl font-semibold">{count}</span>
            </span>
        </button>
    );
}

function RecordStatus({ record }: { record: WorkspaceRecord }) {
    if (record.archived_at) {
        return <Badge variant="outline">Archived</Badge>;
    }

    return record.completed ? (
        <Badge variant="secondary">Completed</Badge>
    ) : (
        <Badge variant="outline">Incomplete</Badge>
    );
}

function formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
