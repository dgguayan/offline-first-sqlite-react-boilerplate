import { Head, router, useForm, usePage } from '@inertiajs/react';
import { KeyRound, Plus, Search, Trash2 } from 'lucide-react';
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
import {
    destroy as destroyModule,
    store as storeModule,
    update as updateModule,
} from '@/routes/admin/permission-modules';
import {
    destroy as destroyPermission,
    store as storePermission,
    update as updatePermission,
} from '@/routes/admin/permissions';
import type {
    PermissionDefinition,
    PermissionModule,
    PermissionScope,
} from '@/types';

export default function PermissionCatalog({
    modules,
}: {
    modules: PermissionModule[];
}) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [search, setSearch] = useState('');
    const [showModuleForm, setShowModuleForm] = useState(false);
    const [showPermissionForm, setShowPermissionForm] = useState(false);
    const visibleModules = useMemo(() => {
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
            .filter(
                (module) =>
                    module.name.toLowerCase().includes(needle) ||
                    module.permissions.length > 0,
            );
    }, [modules, search]);

    return (
        <>
            <Head title="Permissions" />
            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
                <AdminPageHeader
                    title="Permission catalog"
                    description="Define modules and granular permission keys. Application routes and features enforce these keys server-side."
                    actions={
                        <>
                            <Button
                                variant="outline"
                                onClick={() =>
                                    setShowModuleForm((value) => !value)
                                }
                            >
                                <Plus /> Module
                            </Button>
                            <Button
                                onClick={() =>
                                    setShowPermissionForm((value) => !value)
                                }
                                disabled={modules.length === 0}
                            >
                                <Plus /> Permission
                            </Button>
                        </>
                    }
                />
                {Object.keys(errors).length > 0 && (
                    <AlertError errors={Object.values(errors)} />
                )}

                {(showModuleForm || showPermissionForm) && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        {showModuleForm && (
                            <CreateModuleForm
                                onDone={() => setShowModuleForm(false)}
                            />
                        )}
                        {showPermissionForm && (
                            <CreatePermissionForm
                                modules={modules}
                                onDone={() => setShowPermissionForm(false)}
                            />
                        )}
                    </div>
                )}

                <div className="relative max-w-2xl">
                    <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="pl-9"
                        placeholder="Search modules, actions, or permission keys…"
                    />
                </div>

                <div className="space-y-5">
                    {visibleModules.map((module) => (
                        <ModuleCard key={module.id} module={module} />
                    ))}
                    {visibleModules.length === 0 && (
                        <Card>
                            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
                                <KeyRound className="size-8 text-muted-foreground" />
                                <p className="font-medium">
                                    No permissions found
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Create a module and its first permission, or
                                    change your search.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </>
    );
}

function CreateModuleForm({ onDone }: { onDone: () => void }) {
    const form = useForm({
        name: '',
        slug: '',
        description: '',
        sort_order: 100,
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>New module</CardTitle>
                <CardDescription>
                    Groups related page, feature, and action permissions.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(storeModule.url(), {
                            preserveScroll: true,
                            onSuccess: onDone,
                        });
                    }}
                >
                    <TextField
                        label="Name"
                        value={form.data.name}
                        onChange={(value) => {
                            form.setData('name', value);
                            form.setData(
                                'slug',
                                value
                                    .toLowerCase()
                                    .replace(/[^a-z0-9]+/g, '-')
                                    .replace(/^-|-$/g, ''),
                            );
                        }}
                        error={form.errors.name}
                    />
                    <TextField
                        label="Slug"
                        value={form.data.slug}
                        onChange={(value) => form.setData('slug', value)}
                        error={form.errors.slug}
                    />
                    <TextField
                        label="Description"
                        value={form.data.description}
                        onChange={(value) => form.setData('description', value)}
                        error={form.errors.description}
                    />
                    <TextField
                        label="Sort order"
                        type="number"
                        value={String(form.data.sort_order)}
                        onChange={(value) =>
                            form.setData('sort_order', Number(value))
                        }
                        error={form.errors.sort_order}
                    />
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onDone}
                        >
                            Cancel
                        </Button>
                        <Button disabled={form.processing}>
                            Create module
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

function CreatePermissionForm({
    modules,
    onDone,
}: {
    modules: PermissionModule[];
    onDone: () => void;
}) {
    const form = useForm<{
        permission_module_id: number;
        name: string;
        slug: string;
        action: string;
        description: string;
        allowed_scopes: PermissionScope[];
    }>({
        permission_module_id: modules[0]?.id ?? 0,
        name: '',
        slug: '',
        action: 'view',
        description: '',
        allowed_scopes: ['all'],
    });
    const toggleScope = (scope: PermissionScope, checked: boolean) =>
        form.setData(
            'allowed_scopes',
            checked
                ? [...form.data.allowed_scopes, scope]
                : form.data.allowed_scopes.filter(
                      (candidate) => candidate !== scope,
                  ),
        );

    return (
        <Card>
            <CardHeader>
                <CardTitle>New permission</CardTitle>
                <CardDescription>
                    Use a stable resource.action key in backend and frontend
                    checks.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(storePermission.url(), {
                            preserveScroll: true,
                            onSuccess: onDone,
                        });
                    }}
                >
                    <div className="grid gap-2">
                        <Label>Module</Label>
                        <select
                            value={form.data.permission_module_id}
                            onChange={(event) =>
                                form.setData(
                                    'permission_module_id',
                                    Number(event.target.value),
                                )
                            }
                            className="h-9 rounded-md border bg-background px-3 text-sm"
                        >
                            {modules.map((module) => (
                                <option key={module.id} value={module.id}>
                                    {module.name}
                                </option>
                            ))}
                        </select>
                        <InputError
                            message={form.errors.permission_module_id}
                        />
                    </div>
                    <TextField
                        label="Name"
                        value={form.data.name}
                        onChange={(value) => form.setData('name', value)}
                        error={form.errors.name}
                    />
                    <TextField
                        label="Permission key"
                        value={form.data.slug}
                        onChange={(value) =>
                            form.setData(
                                'slug',
                                value.toLowerCase().replace(/\s+/g, '-'),
                            )
                        }
                        error={form.errors.slug}
                        placeholder="reports.export"
                    />
                    <TextField
                        label="Action"
                        value={form.data.action}
                        onChange={(value) =>
                            form.setData(
                                'action',
                                value.toLowerCase().replace(/\s+/g, '-'),
                            )
                        }
                        error={form.errors.action}
                    />
                    <TextField
                        label="Description"
                        value={form.data.description}
                        onChange={(value) => form.setData('description', value)}
                        error={form.errors.description}
                    />
                    <div className="grid gap-2">
                        <Label>Allowed data scopes</Label>
                        <div className="flex flex-wrap gap-4">
                            {(
                                [
                                    'all',
                                    'department',
                                    'own',
                                ] as PermissionScope[]
                            ).map((scope) => (
                                <label
                                    key={scope}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <Checkbox
                                        checked={form.data.allowed_scopes.includes(
                                            scope,
                                        )}
                                        onCheckedChange={(checked) =>
                                            toggleScope(scope, checked === true)
                                        }
                                    />{' '}
                                    {scope}
                                </label>
                            ))}
                        </div>
                        <InputError message={form.errors.allowed_scopes} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onDone}
                        >
                            Cancel
                        </Button>
                        <Button disabled={form.processing}>
                            Create permission
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

function ModuleCard({ module }: { module: PermissionModule }) {
    const [editing, setEditing] = useState(false);
    const form = useForm({
        name: module.name,
        slug: module.slug,
        description: module.description ?? '',
        sort_order: module.sort_order,
    });

    return (
        <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        {editing ? (
                            <form
                                className="grid gap-3 md:grid-cols-2"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    form.put(updateModule.url(module.id), {
                                        preserveScroll: true,
                                        onSuccess: () => setEditing(false),
                                    });
                                }}
                            >
                                <TextField
                                    label="Module name"
                                    value={form.data.name}
                                    onChange={(value) =>
                                        form.setData('name', value)
                                    }
                                    error={form.errors.name}
                                />
                                <TextField
                                    label="Slug"
                                    value={form.data.slug}
                                    onChange={(value) =>
                                        form.setData('slug', value)
                                    }
                                    error={form.errors.slug}
                                />
                                <TextField
                                    label="Description"
                                    value={form.data.description}
                                    onChange={(value) =>
                                        form.setData('description', value)
                                    }
                                    error={form.errors.description}
                                />
                                <TextField
                                    label="Order"
                                    type="number"
                                    value={String(form.data.sort_order)}
                                    onChange={(value) =>
                                        form.setData(
                                            'sort_order',
                                            Number(value),
                                        )
                                    }
                                    error={form.errors.sort_order}
                                />
                                <div className="flex gap-2 md:col-span-2">
                                    <Button
                                        size="sm"
                                        disabled={form.processing}
                                    >
                                        Save
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditing(false)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <>
                                <CardTitle>{module.name}</CardTitle>
                                <CardDescription className="mt-1">
                                    <code>{module.slug}</code>
                                    {module.description
                                        ? ` · ${module.description}`
                                        : ''}
                                </CardDescription>
                            </>
                        )}
                    </div>
                    {!editing && (
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditing(true)}
                            >
                                Edit module
                            </Button>
                            <ConfirmActionDialog
                                trigger={
                                    <Button size="sm" variant="outline">
                                        <Trash2 />
                                    </Button>
                                }
                                title="Delete this module?"
                                description="Modules can only be deleted after every permission in them is removed."
                                confirmLabel="Delete module"
                                destructive
                                onConfirm={() =>
                                    router.delete(destroyModule(module.id), {
                                        preserveScroll: true,
                                    })
                                }
                            />
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {module.permissions.length > 0 ? (
                    <div className="divide-y">
                        {module.permissions.map((permission) => (
                            <PermissionRow
                                key={permission.id}
                                permission={permission}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                        This module has no permissions yet.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function PermissionRow({ permission }: { permission: PermissionDefinition }) {
    const [editing, setEditing] = useState(false);
    const form = useForm({
        permission_module_id: permission.permission_module_id,
        name: permission.name,
        slug: permission.slug,
        action: permission.action,
        description: permission.description ?? '',
        allowed_scopes: permission.allowed_scopes,
    });
    const toggleScope = (scope: PermissionScope, checked: boolean) =>
        form.setData(
            'allowed_scopes',
            checked
                ? [...form.data.allowed_scopes, scope]
                : form.data.allowed_scopes.filter(
                      (candidate) => candidate !== scope,
                  ),
        );

    return (
        <div className="p-4">
            {editing ? (
                <form
                    className="grid gap-3 md:grid-cols-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.put(updatePermission.url(permission.id), {
                            preserveScroll: true,
                            onSuccess: () => setEditing(false),
                        });
                    }}
                >
                    <TextField
                        label="Name"
                        value={form.data.name}
                        onChange={(value) => form.setData('name', value)}
                        error={form.errors.name}
                    />
                    <TextField
                        label="Permission key"
                        value={form.data.slug}
                        onChange={(value) => form.setData('slug', value)}
                        error={form.errors.slug}
                    />
                    <TextField
                        label="Action"
                        value={form.data.action}
                        onChange={(value) => form.setData('action', value)}
                        error={form.errors.action}
                    />
                    <TextField
                        label="Description"
                        value={form.data.description}
                        onChange={(value) => form.setData('description', value)}
                        error={form.errors.description}
                    />
                    <div className="grid gap-2 md:col-span-2">
                        <Label>Allowed data scopes</Label>
                        <div className="flex flex-wrap gap-4">
                            {(
                                [
                                    'all',
                                    'department',
                                    'own',
                                ] as PermissionScope[]
                            ).map((scope) => (
                                <label
                                    key={scope}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <Checkbox
                                        checked={form.data.allowed_scopes.includes(
                                            scope,
                                        )}
                                        onCheckedChange={(checked) =>
                                            toggleScope(scope, checked === true)
                                        }
                                    />
                                    {scope}
                                </label>
                            ))}
                        </div>
                        <InputError message={form.errors.allowed_scopes} />
                    </div>
                    <div className="flex gap-2 md:col-span-2">
                        <Button size="sm" disabled={form.processing}>
                            Save
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(false)}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                                {permission.name}
                            </span>
                            <code className="rounded bg-muted px-1.5 py-1 text-xs">
                                {permission.slug}
                            </code>
                            <Badge variant="outline">{permission.action}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>Scopes:</span>
                            {permission.allowed_scopes.map((scope) => (
                                <Badge key={scope} variant="secondary">
                                    {scope}
                                </Badge>
                            ))}
                            <span>
                                · Used by {permission.roles_count ?? 0} role(s)
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(true)}
                        >
                            Edit
                        </Button>
                        <ConfirmActionDialog
                            trigger={
                                <Button size="sm" variant="outline">
                                    <Trash2 />
                                </Button>
                            }
                            title="Delete this permission?"
                            description="Assigned permissions must first be removed from all roles."
                            confirmLabel="Delete permission"
                            destructive
                            onConfirm={() =>
                                router.delete(
                                    destroyPermission(permission.id),
                                    { preserveScroll: true },
                                )
                            }
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function TextField({
    label,
    value,
    onChange,
    error,
    type = 'text',
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
    placeholder?: string;
}) {
    const id = label.toLowerCase().replaceAll(' ', '-');

    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
            />
            <InputError message={error} />
        </div>
    );
}
