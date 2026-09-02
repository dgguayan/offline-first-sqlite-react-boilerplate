import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { KeyRound, ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    activate,
    deactivate,
    destroy,
    index,
    passwordReset,
    update,
} from '@/routes/admin/users';
import { update as updateRoles } from '@/routes/admin/users/roles';
import type { ManagedUser, RoleSummary } from '@/types';

type PermissionSource = { role: string; permission: string; scope: string };

export default function ShowUser({
    managedUser,
    availableRoles,
    permissionSources,
}: {
    managedUser: ManagedUser;
    availableRoles: RoleSummary[];
    permissionSources: PermissionSource[];
}) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const profile = useForm({
        name: managedUser.name,
        username: managedUser.username ?? '',
        email: managedUser.email,
        job_title: managedUser.job_title ?? '',
        department: managedUser.department ?? '',
        phone: managedUser.phone ?? '',
        bio: managedUser.bio ?? '',
    });
    const roleAssignments = useForm<{
        assignments: { role_id: number; expires_at: string }[];
    }>({
        assignments: managedUser.roles.map((role) => ({
            role_id: role.id,
            expires_at: role.expires_at?.slice(0, 10) ?? '',
        })),
    });

    const toggleRole = (roleId: number, checked: boolean) => {
        roleAssignments.setData(
            'assignments',
            checked
                ? [
                      ...roleAssignments.data.assignments,
                      { role_id: roleId, expires_at: '' },
                  ]
                : roleAssignments.data.assignments.filter(
                      (assignment) => assignment.role_id !== roleId,
                  ),
        );
    };

    return (
        <>
            <Head title={managedUser.name} />
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
                <AdminPageHeader
                    title={managedUser.name}
                    description={`${managedUser.email}${managedUser.username ? ` · @${managedUser.username}` : ''}`}
                    actions={
                        <Button asChild variant="outline">
                            <Link href={index()}>Back to users</Link>
                        </Button>
                    }
                />
                {Object.keys(errors).length > 0 && (
                    <AlertError errors={Object.values(errors)} />
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Metadata label="Status">
                        <Badge
                            variant={
                                managedUser.status === 'active'
                                    ? 'secondary'
                                    : 'destructive'
                            }
                        >
                            {managedUser.status === 'pending'
                                ? 'pending verification'
                                : managedUser.status}
                        </Badge>
                    </Metadata>
                    <Metadata
                        label="Created"
                        value={formatDate(managedUser.created_at)}
                    />
                    <Metadata
                        label="Last login"
                        value={formatDate(managedUser.last_login_at)}
                    />
                    <Metadata
                        label="Updated"
                        value={formatDate(managedUser.updated_at)}
                    />
                </div>

                <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile</CardTitle>
                            <CardDescription>
                                Identity and organizational information.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    profile.put(update.url(managedUser.id));
                                }}
                                className="grid gap-5 md:grid-cols-2"
                            >
                                <Field
                                    label="Full name"
                                    value={profile.data.name}
                                    onChange={(value) =>
                                        profile.setData('name', value)
                                    }
                                    error={profile.errors.name}
                                    disabled={!managedUser.can.update}
                                />
                                <Field
                                    label="Username"
                                    value={profile.data.username}
                                    onChange={(value) =>
                                        profile.setData('username', value)
                                    }
                                    error={profile.errors.username}
                                    disabled={!managedUser.can.update}
                                />
                                <Field
                                    label="Email address"
                                    type="email"
                                    value={profile.data.email}
                                    onChange={(value) =>
                                        profile.setData('email', value)
                                    }
                                    error={profile.errors.email}
                                    disabled={!managedUser.can.update}
                                />
                                <Field
                                    label="Job title"
                                    value={profile.data.job_title}
                                    onChange={(value) =>
                                        profile.setData('job_title', value)
                                    }
                                    error={profile.errors.job_title}
                                    disabled={!managedUser.can.update}
                                />
                                <Field
                                    label="Department"
                                    value={profile.data.department}
                                    onChange={(value) =>
                                        profile.setData('department', value)
                                    }
                                    error={profile.errors.department}
                                    disabled={!managedUser.can.update}
                                />
                                <Field
                                    label="Phone"
                                    value={profile.data.phone}
                                    onChange={(value) =>
                                        profile.setData('phone', value)
                                    }
                                    error={profile.errors.phone}
                                    disabled={!managedUser.can.update}
                                />
                                <div className="grid gap-2 md:col-span-2">
                                    <Label htmlFor="bio">Profile / bio</Label>
                                    <textarea
                                        id="bio"
                                        rows={4}
                                        value={profile.data.bio}
                                        onChange={(event) =>
                                            profile.setData(
                                                'bio',
                                                event.target.value,
                                            )
                                        }
                                        disabled={!managedUser.can.update}
                                        className="rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60"
                                    />
                                    <InputError message={profile.errors.bio} />
                                </div>
                                {managedUser.can.update && (
                                    <div className="md:col-span-2">
                                        <Button disabled={profile.processing}>
                                            {profile.processing
                                                ? 'Saving…'
                                                : 'Save profile'}
                                        </Button>
                                    </div>
                                )}
                            </form>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Security actions</CardTitle>
                                <CardDescription>
                                    Account access changes are audited.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-2">
                                {managedUser.can.deactivate &&
                                    (managedUser.status === 'active' ? (
                                        <ConfirmActionDialog
                                            trigger={
                                                <Button variant="outline">
                                                    <UserX /> Deactivate
                                                </Button>
                                            }
                                            title="Deactivate this user?"
                                            description="The account will be blocked and its active sessions will be revoked."
                                            confirmLabel="Deactivate"
                                            destructive
                                            onConfirm={() =>
                                                router.patch(
                                                    deactivate(managedUser.id),
                                                )
                                            }
                                        />
                                    ) : managedUser.status === 'inactive' ? (
                                        <ConfirmActionDialog
                                            trigger={
                                                <Button variant="outline">
                                                    <UserCheck /> Activate
                                                </Button>
                                            }
                                            title="Activate this user?"
                                            description="The user will be allowed to authenticate again."
                                            confirmLabel="Activate"
                                            onConfirm={() =>
                                                router.patch(
                                                    activate(managedUser.id),
                                                )
                                            }
                                        />
                                    ) : null)}
                                {managedUser.can.reset_password && (
                                    <ConfirmActionDialog
                                        trigger={
                                            <Button variant="outline">
                                                <KeyRound /> Send reset link
                                            </Button>
                                        }
                                        title="Send a password reset email?"
                                        description={`A secure reset link will be sent to ${managedUser.email}.`}
                                        confirmLabel="Send email"
                                        onConfirm={() =>
                                            router.post(
                                                passwordReset(managedUser.id),
                                            )
                                        }
                                    />
                                )}
                                {managedUser.can.delete && (
                                    <ConfirmActionDialog
                                        trigger={
                                            <Button variant="destructive">
                                                <Trash2 /> Delete
                                            </Button>
                                        }
                                        title="Permanently delete this user?"
                                        description="This removes the account and its role assignments. The administrative audit record remains."
                                        confirmLabel="Delete user"
                                        destructive
                                        onConfirm={() =>
                                            router.delete(
                                                destroy(managedUser.id),
                                            )
                                        }
                                    />
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Roles</CardTitle>
                                <CardDescription>
                                    Users may inherit access from multiple
                                    roles. Optional expiry supports temporary
                                    access.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        roleAssignments.put(
                                            updateRoles.url(managedUser.id),
                                            { preserveScroll: true },
                                        );
                                    }}
                                    className="space-y-3"
                                >
                                    {availableRoles.map((role) => {
                                        const assignment =
                                            roleAssignments.data.assignments.find(
                                                (item) =>
                                                    item.role_id === role.id,
                                            );

                                        return (
                                            <div
                                                key={role.id}
                                                className="rounded-lg border p-3"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <Checkbox
                                                        checked={Boolean(
                                                            assignment,
                                                        )}
                                                        onCheckedChange={(
                                                            checked,
                                                        ) =>
                                                            toggleRole(
                                                                role.id,
                                                                checked ===
                                                                    true,
                                                            )
                                                        }
                                                        disabled={
                                                            !managedUser.can
                                                                .assign_roles
                                                        }
                                                        aria-label={`Assign ${role.name}`}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="font-medium">
                                                                {role.name}
                                                            </span>
                                                            <Badge variant="outline">
                                                                {
                                                                    role.permissions_count
                                                                }{' '}
                                                                permissions
                                                            </Badge>
                                                        </div>
                                                        {role.description && (
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                {
                                                                    role.description
                                                                }
                                                            </p>
                                                        )}
                                                        {assignment &&
                                                            managedUser.can
                                                                .assign_roles && (
                                                                <div className="mt-3 grid gap-1">
                                                                    <Label className="text-xs">
                                                                        Expires
                                                                        (optional)
                                                                    </Label>
                                                                    <Input
                                                                        type="date"
                                                                        min={new Date()
                                                                            .toISOString()
                                                                            .slice(
                                                                                0,
                                                                                10,
                                                                            )}
                                                                        value={
                                                                            assignment.expires_at
                                                                        }
                                                                        onChange={(
                                                                            event,
                                                                        ) =>
                                                                            roleAssignments.setData(
                                                                                'assignments',
                                                                                roleAssignments.data.assignments.map(
                                                                                    (
                                                                                        item,
                                                                                    ) =>
                                                                                        item.role_id ===
                                                                                        role.id
                                                                                            ? {
                                                                                                  ...item,
                                                                                                  expires_at:
                                                                                                      event
                                                                                                          .target
                                                                                                          .value,
                                                                                              }
                                                                                            : item,
                                                                                ),
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                            )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <InputError
                                        message={
                                            roleAssignments.errors.assignments
                                        }
                                    />
                                    {managedUser.can.assign_roles && (
                                        <Button
                                            className="w-full"
                                            disabled={
                                                roleAssignments.processing
                                            }
                                        >
                                            <ShieldCheck />{' '}
                                            {roleAssignments.processing
                                                ? 'Saving…'
                                                : 'Save role assignments'}
                                        </Button>
                                    )}
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Effective permission sources</CardTitle>
                        <CardDescription>
                            Every grant below is inherited from an assigned,
                            active role. When roles overlap, the widest data
                            scope wins.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {permissionSources.length > 0 ? (
                            <div className="overflow-x-auto rounded-lg border">
                                <Table>
                                    <TableHeader className="bg-muted/50 text-left">
                                        <TableRow>
                                            <TableHead className="px-4 py-3">
                                                Permission
                                            </TableHead>
                                            <TableHead className="px-4 py-3">
                                                Inherited from
                                            </TableHead>
                                            <TableHead className="px-4 py-3">
                                                Data scope
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {permissionSources.map(
                                            (source, index) => (
                                                <TableRow
                                                    key={`${source.role}-${source.permission}-${index}`}
                                                >
                                                    <TableCell className="px-4 py-3 font-mono text-xs">
                                                        {source.permission}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3">
                                                        {source.role}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3">
                                                        <Badge variant="outline">
                                                            {source.scope}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ),
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                                No effective permissions. Assign an active role
                                to grant access.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

function Metadata({
    label,
    value,
    children,
}: {
    label: string;
    value?: string;
    children?: React.ReactNode;
}) {
    return (
        <Card className="gap-1 p-4">
            <span className="text-xs font-medium text-muted-foreground uppercase">
                {label}
            </span>
            <div className="font-medium">{children ?? value}</div>
        </Card>
    );
}

function Field({
    label,
    value,
    onChange,
    error,
    type = 'text',
    disabled,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
    disabled: boolean;
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
                disabled={disabled}
            />
            <InputError message={error} />
        </div>
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
