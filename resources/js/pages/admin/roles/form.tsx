import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { CheckCheck, Eraser, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import AlertError from '@/components/alert-error';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { destroy, index, store, update } from '@/routes/admin/roles';
import type { Auth, PermissionModule, PermissionScope } from '@/types';

type PermissionGrant = { permission_id: number; scope: PermissionScope };
type ManagedRole = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    is_active: boolean;
    is_default: boolean;
    users_count: number;
    permissions: PermissionGrant[];
};

export default function RoleForm({
    managedRole,
    modules,
    canManagePermissions,
}: {
    managedRole: ManagedRole | null;
    modules: PermissionModule[];
    canManagePermissions: boolean;
}) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const pageErrors = usePage<{ errors: Record<string, string> }>().props
        .errors;
    const [search, setSearch] = useState('');
    const form = useForm({
        name: managedRole?.name ?? '',
        slug: managedRole?.slug ?? '',
        description: managedRole?.description ?? '',
        is_active: managedRole?.is_active ?? true,
        is_default: managedRole?.is_default ?? false,
        permissions: managedRole?.permissions ?? ([] as PermissionGrant[]),
    });
    const filteredModules = useMemo(() => {
        const needle = search.toLowerCase().trim();

        if (!needle) {
            return modules;
        }

        return modules
            .map((module) => ({
                ...module,
                permissions: module.permissions.filter((permission) =>
                    `${module.name} ${permission.name} ${permission.slug} ${permission.action}`
                        .toLowerCase()
                        .includes(needle),
                ),
            }))
            .filter((module) => module.permissions.length > 0);
    }, [modules, search]);
    const selectedIds = new Set(
        form.data.permissions.map((grant) => grant.permission_id),
    );

    const setSelected = (
        permissionId: number,
        selected: boolean,
        scope?: PermissionScope,
    ) => {
        const permission = modules
            .flatMap((module) => module.permissions)
            .find((candidate) => candidate.id === permissionId);
        form.setData(
            'permissions',
            selected
                ? [
                      ...form.data.permissions.filter(
                          (grant) => grant.permission_id !== permissionId,
                      ),
                      {
                          permission_id: permissionId,
                          scope:
                              scope ??
                              defaultScope(
                                  permission?.allowed_scopes ?? ['all'],
                              ),
                      },
                  ]
                : form.data.permissions.filter(
                      (grant) => grant.permission_id !== permissionId,
                  ),
        );
    };
    const selectPermissions = (permissionIds: number[]) => {
        const next = new Map(
            form.data.permissions.map((grant) => [grant.permission_id, grant]),
        );
        modules
            .flatMap((module) => module.permissions)
            .filter((permission) => permissionIds.includes(permission.id))
            .forEach((permission) =>
                next.set(permission.id, {
                    permission_id: permission.id,
                    scope: defaultScope(permission.allowed_scopes),
                }),
            );
        form.setData('permissions', [...next.values()]);
    };
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.transform((data) =>
            canManagePermissions
                ? data
                : {
                      name: data.name,
                      slug: data.slug,
                      description: data.description,
                      is_active: data.is_active,
                      is_default: data.is_default,
                  },
        );

        if (managedRole) {
            form.put(update.url(managedRole.id));
        } else {
            form.post(store.url());
        }
    };

    return (
        <>
            <Head
                title={
                    managedRole
                        ? `Configure ${managedRole.name}`
                        : 'Create role'
                }
            />
            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
                <AdminPageHeader
                    title={
                        managedRole
                            ? `Configure ${managedRole.name}`
                            : 'Create role'
                    }
                    description="Role names are descriptive; permissions are the actual security boundary."
                    actions={
                        <Button asChild variant="outline">
                            <Link href={index()}>Back to roles</Link>
                        </Button>
                    }
                />
                {Object.keys(pageErrors).length > 0 && (
                    <AlertError errors={Object.values(pageErrors)} />
                )}
                <form onSubmit={submit} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Role details</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-5 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={form.data.name}
                                    onChange={(event) =>
                                        form.setData('name', event.target.value)
                                    }
                                    required
                                />
                                <InputError message={form.errors.name} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="slug">Slug</Label>
                                <Input
                                    id="slug"
                                    value={form.data.slug}
                                    onChange={(event) =>
                                        form.setData(
                                            'slug',
                                            event.target.value
                                                .toLowerCase()
                                                .replace(/\s+/g, '-'),
                                        )
                                    }
                                    required
                                />
                                <InputError message={form.errors.slug} />
                            </div>
                            <div className="grid gap-2 md:col-span-2">
                                <Label htmlFor="description">Description</Label>
                                <textarea
                                    id="description"
                                    rows={3}
                                    value={form.data.description}
                                    onChange={(event) =>
                                        form.setData(
                                            'description',
                                            event.target.value,
                                        )
                                    }
                                    className="rounded-md border bg-background px-3 py-2 text-sm"
                                />
                                <InputError message={form.errors.description} />
                            </div>
                            <label className="flex items-center gap-3 rounded-lg border p-3">
                                <Checkbox
                                    checked={form.data.is_active}
                                    onCheckedChange={(checked) =>
                                        form.setData(
                                            'is_active',
                                            checked === true,
                                        )
                                    }
                                />
                                <span>
                                    <span className="block font-medium">
                                        Active role
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Inactive roles grant no effective
                                        permissions.
                                    </span>
                                </span>
                            </label>
                            <label className="flex items-center gap-3 rounded-lg border p-3">
                                <Checkbox
                                    checked={form.data.is_default}
                                    onCheckedChange={(checked) =>
                                        form.setData(
                                            'is_default',
                                            checked === true,
                                        )
                                    }
                                />
                                <span>
                                    <span className="block font-medium">
                                        Default registration role
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Automatically assigned to new
                                        self-registered accounts.
                                    </span>
                                </span>
                            </label>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <CardTitle>Permission matrix</CardTitle>
                                    <CardDescription className="mt-1">
                                        Select granular actions and the maximum
                                        data scope granted by this role.
                                    </CardDescription>
                                </div>
                                <Badge variant="secondary">
                                    {form.data.permissions.length} selected
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <div className="relative flex-1">
                                    <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        className="pl-9"
                                        placeholder="Search permissions…"
                                    />
                                </div>
                                {canManagePermissions && (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                selectPermissions(
                                                    modules.flatMap((module) =>
                                                        module.permissions.map(
                                                            (permission) =>
                                                                permission.id,
                                                        ),
                                                    ),
                                                )
                                            }
                                        >
                                            <CheckCheck /> Select all
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                form.setData('permissions', [])
                                            }
                                        >
                                            <Eraser /> Clear
                                        </Button>
                                    </>
                                )}
                            </div>
                            {!canManagePermissions && (
                                <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                                    You may edit role details, but your account
                                    cannot change permission grants.
                                </p>
                            )}
                            {filteredModules.map((module) => {
                                const moduleIds = module.permissions.map(
                                    (permission) => permission.id,
                                );
                                const allSelected = moduleIds.every((id) =>
                                    selectedIds.has(id),
                                );

                                return (
                                    <div
                                        key={module.id}
                                        className="overflow-hidden rounded-lg border"
                                    >
                                        <div className="flex flex-col gap-3 bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <h3 className="font-medium">
                                                    {module.name}
                                                </h3>
                                                {module.description && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {module.description}
                                                    </p>
                                                )}
                                            </div>
                                            {canManagePermissions && (
                                                <label className="flex items-center gap-2 text-sm">
                                                    <Checkbox
                                                        checked={allSelected}
                                                        onCheckedChange={(
                                                            checked,
                                                        ) =>
                                                            checked
                                                                ? selectPermissions(
                                                                      moduleIds,
                                                                  )
                                                                : form.setData(
                                                                      'permissions',
                                                                      form.data.permissions.filter(
                                                                          (
                                                                              grant,
                                                                          ) =>
                                                                              !moduleIds.includes(
                                                                                  grant.permission_id,
                                                                              ),
                                                                      ),
                                                                  )
                                                        }
                                                    />{' '}
                                                    Select module
                                                </label>
                                            )}
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="border-y bg-muted/20 text-left text-xs text-muted-foreground uppercase">
                                                    <tr>
                                                        <th className="px-4 py-2">
                                                            Allow
                                                        </th>
                                                        <th className="px-4 py-2">
                                                            Action
                                                        </th>
                                                        <th className="px-4 py-2">
                                                            Permission key
                                                        </th>
                                                        <th className="px-4 py-2">
                                                            Data scope
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {module.permissions.map(
                                                        (permission) => {
                                                            const grant =
                                                                form.data.permissions.find(
                                                                    (
                                                                        candidate,
                                                                    ) =>
                                                                        candidate.permission_id ===
                                                                        permission.id,
                                                                );

                                                            return (
                                                                <tr
                                                                    key={
                                                                        permission.id
                                                                    }
                                                                >
                                                                    <td className="px-4 py-3">
                                                                        <Checkbox
                                                                            checked={Boolean(
                                                                                grant,
                                                                            )}
                                                                            disabled={
                                                                                !canManagePermissions
                                                                            }
                                                                            onCheckedChange={(
                                                                                checked,
                                                                            ) =>
                                                                                setSelected(
                                                                                    permission.id,
                                                                                    checked ===
                                                                                        true,
                                                                                )
                                                                            }
                                                                            aria-label={`Grant ${permission.name}`}
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="font-medium">
                                                                            {
                                                                                permission.name
                                                                            }
                                                                        </div>
                                                                        {permission.description && (
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {
                                                                                    permission.description
                                                                                }
                                                                            </p>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <code className="rounded bg-muted px-1.5 py-1 text-xs">
                                                                            {
                                                                                permission.slug
                                                                            }
                                                                        </code>
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        {grant ? (
                                                                            <select
                                                                                value={
                                                                                    grant.scope
                                                                                }
                                                                                disabled={
                                                                                    !canManagePermissions ||
                                                                                    permission
                                                                                        .allowed_scopes
                                                                                        .length ===
                                                                                        1
                                                                                }
                                                                                onChange={(
                                                                                    event,
                                                                                ) =>
                                                                                    setSelected(
                                                                                        permission.id,
                                                                                        true,
                                                                                        event
                                                                                            .target
                                                                                            .value as PermissionScope,
                                                                                    )
                                                                                }
                                                                                className="h-8 rounded-md border bg-background px-2 text-xs"
                                                                            >
                                                                                {permission.allowed_scopes.map(
                                                                                    (
                                                                                        scope,
                                                                                    ) => (
                                                                                        <option
                                                                                            key={
                                                                                                scope
                                                                                            }
                                                                                            value={
                                                                                                scope
                                                                                            }
                                                                                        >
                                                                                            {scopeLabel(
                                                                                                scope,
                                                                                            )}
                                                                                        </option>
                                                                                    ),
                                                                                )}
                                                                            </select>
                                                                        ) : (
                                                                            <span className="text-muted-foreground">
                                                                                Not
                                                                                granted
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        },
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredModules.length === 0 && (
                                <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                                    No permissions match your search.
                                </p>
                            )}
                            <InputError message={form.errors.permissions} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Effective permission summary</CardTitle>
                            <CardDescription>
                                This role currently grants{' '}
                                {form.data.permissions.length} permission
                                {form.data.permissions.length === 1 ? '' : 's'}.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {form.data.permissions.map((grant) => {
                                    const permission = modules
                                        .flatMap((module) => module.permissions)
                                        .find(
                                            (candidate) =>
                                                candidate.id ===
                                                grant.permission_id,
                                        );

                                    return permission ? (
                                        <Badge
                                            key={grant.permission_id}
                                            variant="outline"
                                        >
                                            <code>{permission.slug}</code> ·{' '}
                                            {grant.scope}
                                        </Badge>
                                    ) : null;
                                })}
                                {form.data.permissions.length === 0 && (
                                    <span className="text-sm text-muted-foreground">
                                        No access will be inherited from this
                                        role.
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            {managedRole &&
                                'roles.delete' in auth.permissions && (
                                    <ConfirmActionDialog
                                        trigger={
                                            <Button
                                                type="button"
                                                variant="destructive"
                                            >
                                                <Trash2 /> Delete role
                                            </Button>
                                        }
                                        title="Delete this role?"
                                        description={
                                            managedRole.users_count > 0
                                                ? `This role is assigned to ${managedRole.users_count} user(s) and must be unassigned before deletion.`
                                                : 'This permanently removes the role. Audit history is retained.'
                                        }
                                        confirmLabel="Delete role"
                                        destructive
                                        onConfirm={() =>
                                            router.delete(
                                                destroy(managedRole.id),
                                            )
                                        }
                                    />
                                )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button asChild variant="outline">
                                <Link href={index()}>Cancel</Link>
                            </Button>
                            <Button disabled={form.processing}>
                                {form.processing
                                    ? 'Saving…'
                                    : managedRole
                                      ? 'Save role'
                                      : 'Create role'}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </>
    );
}

function defaultScope(scopes: PermissionScope[]): PermissionScope {
    return scopes.includes('all') ? 'all' : (scopes[0] ?? 'own');
}
function scopeLabel(scope: PermissionScope): string {
    return scope === 'all'
        ? 'All records'
        : scope === 'department'
          ? 'Department records'
          : 'Own records';
}
