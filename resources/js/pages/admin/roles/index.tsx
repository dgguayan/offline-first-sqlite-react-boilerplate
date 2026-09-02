import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Pagination } from '@/components/admin/pagination';
import { DataTable } from '@/components/data-table';
import type { DataTableColumnDef } from '@/components/data-table-features';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { create, edit, index } from '@/routes/admin/roles';
import type { Auth, Paginated, RoleSummary } from '@/types';

export default function RolesIndex({
    roles,
    filters,
}: {
    roles: Paginated<RoleSummary>;
    filters: { search?: string };
}) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const [search, setSearch] = useState(filters.search ?? '');
    const canEditRoles = 'roles.edit' in auth.permissions;
    const columns = useMemo<Array<DataTableColumnDef<RoleSummary>>>(
        () => [
            {
                accessorKey: 'name',
                header: 'Role',
                cell: ({ row }) => (
                    <div>
                        <div className="flex items-center gap-2 font-medium">
                            {row.original.name}
                            {row.original.is_default && (
                                <Badge variant="outline">Default</Badge>
                            )}
                        </div>
                        <code className="text-xs text-muted-foreground">
                            {row.original.slug}
                        </code>
                    </div>
                ),
            },
            {
                accessorKey: 'is_active',
                header: 'Status',
                cell: ({ row }) => (
                    <Badge
                        variant={
                            row.original.is_active ? 'secondary' : 'destructive'
                        }
                    >
                        {row.original.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                ),
            },
            {
                accessorKey: 'users_count',
                header: 'Users',
                cell: ({ row }) => row.original.users_count ?? 0,
            },
            {
                accessorKey: 'permissions_count',
                header: 'Permissions',
                cell: ({ row }) => row.original.permissions_count ?? 0,
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">Actions</span>,
                cell: ({ row }) => (
                    <div className="text-right">
                        {canEditRoles && (
                            <Button asChild size="sm" variant="outline">
                                <Link href={edit(row.original.id)}>
                                    Configure
                                </Link>
                            </Button>
                        )}
                    </div>
                ),
                enableGlobalFilter: false,
                enableHiding: false,
                enableSorting: false,
            },
        ],
        [canEditRoles],
    );

    return (
        <>
            <Head title="Roles" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <AdminPageHeader
                    title="Roles"
                    description="Combine granular permissions into reusable, dynamic access profiles."
                    actions={
                        'roles.create' in auth.permissions ? (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus /> Create role
                                </Link>
                            </Button>
                        ) : undefined
                    }
                />
                <Card className="gap-0 overflow-hidden py-0">
                    <form
                        className="flex gap-2 border-b p-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            router.get(
                                index(),
                                { search },
                                { preserveState: true, replace: true },
                            );
                        }}
                    >
                        <div className="relative max-w-xl flex-1">
                            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                className="pl-9"
                                placeholder="Search role name or slug…"
                            />
                        </div>
                        <Button variant="secondary">Search</Button>
                    </form>
                    <DataTable
                        columns={columns}
                        data={roles.data}
                        processingMode="server"
                        showSearch={false}
                        showColumnVisibility={false}
                        showPagination={false}
                        showSelectionSummary={false}
                        tableContainerClassName="rounded-none border-x-0 border-t-0"
                        emptyState={
                            <div className="flex flex-col items-center gap-2 py-8 text-center">
                                <ShieldCheck className="size-8 text-muted-foreground" />
                                <p className="font-medium">No roles found</p>
                                <p className="text-sm text-muted-foreground">
                                    Create a role or change your search.
                                </p>
                            </div>
                        }
                    />
                    <Pagination
                        links={roles.links}
                        from={roles.from}
                        to={roles.to}
                        total={roles.total}
                    />
                </Card>
            </div>
        </>
    );
}
