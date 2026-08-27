import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Pagination } from '@/components/admin/pagination';
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
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Users</th>
                                    <th className="px-4 py-3">Permissions</th>
                                    <th className="px-4 py-3 text-right">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {roles.data.map((role) => (
                                    <tr
                                        key={role.id}
                                        className="hover:bg-muted/30"
                                    >
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2 font-medium">
                                                {role.name}
                                                {role.is_default && (
                                                    <Badge variant="outline">
                                                        Default
                                                    </Badge>
                                                )}
                                            </div>
                                            <code className="text-xs text-muted-foreground">
                                                {role.slug}
                                            </code>
                                        </td>
                                        <td className="px-4 py-4">
                                            <Badge
                                                variant={
                                                    role.is_active
                                                        ? 'secondary'
                                                        : 'destructive'
                                                }
                                            >
                                                {role.is_active
                                                    ? 'Active'
                                                    : 'Inactive'}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-4">
                                            {role.users_count ?? 0}
                                        </td>
                                        <td className="px-4 py-4">
                                            {role.permissions_count ?? 0}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            {'roles.edit' in
                                                auth.permissions && (
                                                <Button
                                                    asChild
                                                    size="sm"
                                                    variant="outline"
                                                >
                                                    <Link href={edit(role.id)}>
                                                        Configure
                                                    </Link>
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {roles.data.length === 0 && (
                        <div className="flex flex-col items-center gap-2 p-16 text-center">
                            <ShieldCheck className="size-8 text-muted-foreground" />
                            <p className="font-medium">No roles found</p>
                            <p className="text-sm text-muted-foreground">
                                Create a role or change your search.
                            </p>
                        </div>
                    )}
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
