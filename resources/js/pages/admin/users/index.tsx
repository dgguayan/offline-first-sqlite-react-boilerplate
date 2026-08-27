import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowUpDown, Plus, Search, UserRound } from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Pagination } from '@/components/admin/pagination';
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

    const visit = (next: Record<string, string>) => {
        router.get(
            index(),
            { ...filters, search, ...next },
            { preserveState: true, replace: true },
        );
    };

    const sortBy = (sort: string) => {
        visit({
            sort,
            direction:
                filters.sort === sort && filters.direction === 'asc'
                    ? 'desc'
                    : 'asc',
        });
    };

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

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                <tr>
                                    {[
                                        ['name', 'User'],
                                        ['status', 'Status'],
                                        ['last_login_at', 'Last login'],
                                        ['created_at', 'Created'],
                                    ].map(([key, label]) => (
                                        <th
                                            key={key}
                                            className="px-4 py-3 font-medium"
                                        >
                                            <button
                                                className="flex items-center gap-1"
                                                onClick={() => sortBy(key)}
                                            >
                                                {label}{' '}
                                                <ArrowUpDown className="size-3" />
                                            </button>
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 font-medium">
                                        Roles
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {users.data.map((user) => (
                                    <tr
                                        key={user.id}
                                        className="hover:bg-muted/30"
                                    >
                                        <td className="px-4 py-4">
                                            <div className="font-medium">
                                                {user.name}
                                            </div>
                                            <div className="text-muted-foreground">
                                                {user.email}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {user.username
                                                    ? `@${user.username}`
                                                    : 'No username'}
                                                {user.department
                                                    ? ` · ${user.department}`
                                                    : ''}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <Badge
                                                variant={
                                                    user.status === 'active'
                                                        ? 'secondary'
                                                        : 'destructive'
                                                }
                                            >
                                                {user.status}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-4 text-muted-foreground">
                                            {formatDate(user.last_login_at)}
                                        </td>
                                        <td className="px-4 py-4 text-muted-foreground">
                                            {formatDate(user.created_at)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex max-w-xs flex-wrap gap-1">
                                                {user.roles.length > 0 ? (
                                                    user.roles.map((role) => (
                                                        <Badge
                                                            key={role.id}
                                                            variant="outline"
                                                        >
                                                            {role.name}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        No roles
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            {user.can.view && (
                                                <Button
                                                    asChild
                                                    size="sm"
                                                    variant="outline"
                                                >
                                                    <Link href={show(user.id)}>
                                                        View
                                                    </Link>
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {users.data.length === 0 && (
                        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                            <UserRound className="size-8 text-muted-foreground" />
                            <p className="font-medium">No users found</p>
                            <p className="text-sm text-muted-foreground">
                                Try changing your search or filters.
                            </p>
                        </div>
                    )}

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

function formatDate(value: string | null): string {
    return value
        ? new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(new Date(value))
        : 'Never';
}
