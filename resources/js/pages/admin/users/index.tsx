import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowUpDown, Plus, Search, UserRound } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Pagination } from '@/components/admin/pagination';
import { DataTable } from '@/components/data-table';
import type { DataTableColumnDef } from '@/components/data-table-features';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { create, index, show } from '@/routes/admin/users';
import type { Auth, ManagedUser, Paginated, RoleSummary } from '@/types';

type Props = {
    users: Paginated<ManagedUser>;
    roles: RoleSummary[];
    filters: {
        search?: string;
        status?: string;
        role?: string;
        sort?: string;
        direction?: string;
    };
};

export default function UsersIndex({ users, roles, filters }: Props) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const [search, setSearch] = useState(filters.search ?? '');

    const visit = useCallback(
        (next: Record<string, string>) => {
            router.get(
                index(),
                { ...filters, search, ...next },
                { preserveState: true, replace: true },
            );
        },
        [filters, search],
    );

    const sortBy = useCallback(
        (sort: string) => {
            visit({
                sort,
                direction:
                    filters.sort === sort && filters.direction === 'asc'
                        ? 'desc'
                        : 'asc',
            });
        },
        [filters.direction, filters.sort, visit],
    );

    const columns = useMemo<Array<DataTableColumnDef<ManagedUser>>>(
        () => [
            {
                accessorKey: 'name',
                header: () => (
                    <ServerSortHeader
                        label="User"
                        onClick={() => sortBy('name')}
                    />
                ),
                cell: ({ row }) => (
                    <div className="min-w-64">
                        <div className="font-medium">{row.original.name}</div>
                        <div className="text-muted-foreground">
                            {row.original.email}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {row.original.username
                                ? `@${row.original.username}`
                                : 'No username'}
                            {row.original.department
                                ? ` · ${row.original.department}`
                                : ''}
                        </div>
                    </div>
                ),
            },
            {
                accessorKey: 'status',
                header: () => (
                    <ServerSortHeader
                        label="Status"
                        onClick={() => sortBy('status')}
                    />
                ),
                cell: ({ row }) => (
                    <Badge
                        variant={
                            row.original.status === 'active'
                                ? 'secondary'
                                : row.original.status === 'pending'
                                  ? 'outline'
                                  : 'destructive'
                        }
                    >
                        {row.original.status === 'pending'
                            ? 'pending verification'
                            : row.original.status}
                    </Badge>
                ),
            },
            {
                accessorKey: 'last_login_at',
                header: () => (
                    <ServerSortHeader
                        label="Last login"
                        onClick={() => sortBy('last_login_at')}
                    />
                ),
                cell: ({ row }) => (
                    <span className="text-muted-foreground">
                        {formatDate(row.original.last_login_at)}
                    </span>
                ),
            },
            {
                accessorKey: 'created_at',
                header: () => (
                    <ServerSortHeader
                        label="Created"
                        onClick={() => sortBy('created_at')}
                    />
                ),
                cell: ({ row }) => (
                    <span className="text-muted-foreground">
                        {formatDate(row.original.created_at)}
                    </span>
                ),
            },
            {
                id: 'roles',
                header: 'Roles',
                cell: ({ row }) => (
                    <div className="flex max-w-xs flex-wrap gap-1">
                        {row.original.roles.length > 0 ? (
                            row.original.roles.map((role) => (
                                <Badge key={role.id} variant="outline">
                                    {role.name}
                                </Badge>
                            ))
                        ) : (
                            <span className="text-muted-foreground">
                                No roles
                            </span>
                        )}
                    </div>
                ),
                enableGlobalFilter: false,
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">Actions</span>,
                cell: ({ row }) => (
                    <div className="text-right">
                        {row.original.can.view && (
                            <Button asChild size="sm" variant="outline">
                                <Link href={show(row.original.id)}>View</Link>
                            </Button>
                        )}
                    </div>
                ),
                enableGlobalFilter: false,
                enableHiding: false,
                enableSorting: false,
            },
        ],
        [sortBy],
    );

    return (
        <>
            <Head title="Users" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <AdminPageHeader
                    title="Users"
                    description="Manage accounts, access, status, and security metadata."
                    actions={
                        'users.create' in auth.permissions ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus /> Add user
                                </Link>
                            </Button>
                        ) : undefined
                    }
                />

                <Card className="gap-0 overflow-hidden py-0">
                    <form
                        className="grid gap-3 border-b p-4 md:grid-cols-[1fr_180px_220px_auto]"
                        onSubmit={(event) => {
                            event.preventDefault();
                            visit({});
                        }}
                    >
                        <div className="relative">
                            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                className="pl-9"
                                placeholder="Search name, email, username, department…"
                                aria-label="Search users"
                            />
                        </div>
                        <select
                            value={filters.status ?? ''}
                            onChange={(event) =>
                                visit({ status: event.target.value })
                            }
                            className="h-9 rounded-md border bg-background px-3 text-sm"
                            aria-label="Filter by status"
                        >
                            <option value="">All statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="pending">
                                Pending verification
                            </option>
                            <option value="declined">Declined</option>
                        </select>
                        <select
                            value={filters.role ?? ''}
                            onChange={(event) =>
                                visit({ role: event.target.value })
                            }
                            className="h-9 rounded-md border bg-background px-3 text-sm"
                            aria-label="Filter by role"
                        >
                            <option value="">All roles</option>
                            {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                    {role.name}
                                </option>
                            ))}
                        </select>
                        <Button type="submit" variant="secondary">
                            Search
                        </Button>
                    </form>

                    <DataTable
                        columns={columns}
                        data={users.data}
                        processingMode="server"
                        showSearch={false}
                        showColumnVisibility={false}
                        showPagination={false}
                        showSelectionSummary={false}
                        tableContainerClassName="rounded-none border-x-0 border-t-0"
                        emptyState={
                            <div className="flex flex-col items-center gap-2 py-8 text-center">
                                <UserRound className="size-8 text-muted-foreground" />
                                <p className="font-medium">No users found</p>
                                <p className="text-sm text-muted-foreground">
                                    Try changing your search or filters.
                                </p>
                            </div>
                        }
                    />

                    <Pagination
                        links={users.links}
                        from={users.from}
                        to={users.to}
                        total={users.total}
                    />
                </Card>
            </div>
        </>
    );
}

function ServerSortHeader({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={onClick}
        >
            {label}
            <ArrowUpDown />
        </Button>
    );
}

function formatDate(value: string | null): string {
    return value
        ? new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(new Date(value))
        : 'Never';
}
