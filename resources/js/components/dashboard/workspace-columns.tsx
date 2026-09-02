import { Link } from '@inertiajs/react';
import { ArrowUpRight, FolderKanban, ListTodo } from 'lucide-react';
import type { MouseEvent } from 'react';
import { DataTableColumnHeader } from '@/components/data-table-column-header';
import type { DataTableColumnDef } from '@/components/data-table-features';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { DashboardWorkspaceItem } from '@/lib/dashboard';
import { projects, tasks } from '@/routes';

export function createWorkspaceColumns(
    onNavigate: (event: MouseEvent<Element>, targetUrl: string) => void,
): Array<DataTableColumnDef<DashboardWorkspaceItem>> {
    return [
        {
            id: 'select',
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && 'indeterminate')
                    }
                    onCheckedChange={(value) =>
                        table.toggleAllPageRowsSelected(Boolean(value))
                    }
                    aria-label="Select all visible rows"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) =>
                        row.toggleSelected(Boolean(value))
                    }
                    aria-label={`Select ${row.original.title}`}
                />
            ),
            enableGlobalFilter: false,
            enableHiding: false,
            enableSorting: false,
        },
        {
            accessorKey: 'title',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Workspace item" />
            ),
            cell: ({ row }) => {
                const Icon =
                    row.original.type === 'task' ? ListTodo : FolderKanban;

                return (
                    <div className="flex min-w-56 items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="max-w-72 truncate font-medium">
                            {row.original.title}
                        </span>
                    </div>
                );
            },
            sortFn: 'text',
        },
        {
            accessorKey: 'type',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Type" />
            ),
            cell: ({ row }) => (
                <Badge variant="outline" className="capitalize">
                    {row.original.type}
                </Badge>
            ),
            sortFn: 'text',
        },
        {
            accessorKey: 'status',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Status" />
            ),
            cell: ({ row }) => (
                <Badge
                    variant={
                        row.original.status === 'completed'
                            ? 'secondary'
                            : 'outline'
                    }
                    className="capitalize"
                >
                    {row.original.status}
                </Badge>
            ),
            sortFn: 'text',
        },
        {
            accessorKey: 'syncStatus',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Sync" />
            ),
            cell: ({ row }) => (
                <Badge
                    variant={
                        row.original.syncStatus === 'error' ||
                        row.original.syncStatus === 'conflict'
                            ? 'destructive'
                            : row.original.syncStatus === 'synced'
                              ? 'secondary'
                              : 'outline'
                    }
                    className="capitalize"
                >
                    {row.original.syncStatus}
                </Badge>
            ),
            sortFn: 'text',
        },
        {
            accessorKey: 'updatedAt',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Updated" />
            ),
            cell: ({ row }) => (
                <time
                    dateTime={row.original.updatedAt}
                    className="text-muted-foreground"
                >
                    {formatUpdatedAt(row.original.updatedAt)}
                </time>
            ),
            sortDescFirst: true,
            sortFn: 'datetime',
        },
        {
            id: 'actions',
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => {
                const target =
                    row.original.type === 'task' ? tasks() : projects();

                return (
                    <Button asChild variant="ghost" size="icon">
                        <Link
                            href={target}
                            onClick={(event) => onNavigate(event, target.url)}
                            aria-label={`Open ${row.original.type} workspace`}
                        >
                            <ArrowUpRight />
                        </Link>
                    </Button>
                );
            },
            enableGlobalFilter: false,
            enableHiding: false,
            enableSorting: false,
        },
    ];
}

function formatUpdatedAt(updatedAt: string): string {
    const date = new Date(updatedAt);

    if (Number.isNaN(date.getTime())) {
        return 'Unknown';
    }

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year:
            date.getFullYear() === new Date().getFullYear()
                ? undefined
                : 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}
