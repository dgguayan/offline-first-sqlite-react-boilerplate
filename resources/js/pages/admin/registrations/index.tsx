import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Clock3,
    Search,
    ShieldCheck,
    Trash2,
    UserCheck,
    UserRoundSearch,
    UserX,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import { Pagination } from '@/components/admin/pagination';
import AlertError from '@/components/alert-error';
import { DataTable } from '@/components/data-table';
import type { DataTableColumnDef } from '@/components/data-table-features';
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
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { update as updateRegistrationSetting } from '@/routes/admin/registration-settings';
import { approve, decline, index } from '@/routes/admin/registrations';
import type { Paginated } from '@/types';

type RegistrationView = 'pending' | 'declined' | 'expired';

type RegistrationRow = {
    id: number | string;
    user_id: number | string;
    name: string;
    email: string;
    username?: string | null;
    status: 'pending' | 'declined' | 'expired_deleted';
    registered_at: string | null;
    verification_expires_at: string | null;
    resolved_at: string | null;
    decline_reason: string | null;
    remaining_seconds: number | null;
    is_approaching_expiration: boolean;
    can_review: boolean;
};

type ExpiredAuditRow = {
    id: number;
    subject_id: string | null;
    metadata: {
        user_id?: number | string;
        name?: string;
        email?: string;
        registered_at?: string;
        verification_expires_at?: string;
        expired_at?: string;
    } | null;
    created_at: string;
};

type Props = {
    registrations: Paginated<RegistrationRow | ExpiredAuditRow>;
    filters: { view: RegistrationView; search: string };
    settings: { pending_expiration_days: number; can_manage: boolean };
    counts: {
        pending: number;
        approaching_expiration: number;
        declined: number;
        expired: number;
    };
};

export default function RegistrationVerification({
    registrations,
    filters,
    settings,
    counts,
}: Props) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [search, setSearch] = useState(filters.search);
    const [processingUserId, setProcessingUserId] = useState<
        number | string | null
    >(null);
    const [declining, setDeclining] = useState<RegistrationRow | null>(null);
    const declineForm = useForm({ reason: '' });
    const expirationForm = useForm({
        pending_expiration_days: settings.pending_expiration_days,
    });
    const registrationRows = useMemo(
        () => registrations.data.map(normalizeRegistration),
        [registrations.data],
    );

    const visit = (view: RegistrationView, nextSearch = search) => {
        router.get(
            index(),
            { view, search: nextSearch },
            { preserveState: true, replace: true },
        );
    };

    const approveRegistration = useCallback((registration: RegistrationRow) => {
        setProcessingUserId(registration.user_id);
        router.patch(
            approve(Number(registration.user_id)),
            {},
            {
                preserveScroll: true,
                onFinish: () => setProcessingUserId(null),
            },
        );
    }, []);

    const submitDecline = () => {
        if (declining === null) {
            return;
        }

        declineForm.patch(decline.url(Number(declining.user_id)), {
            preserveScroll: true,
            onSuccess: () => {
                setDeclining(null);
                declineForm.reset();
            },
        });
    };

    const columns = useMemo<Array<DataTableColumnDef<RegistrationRow>>>(
        () => [
            {
                accessorKey: 'name',
                header: 'Applicant',
                cell: ({ row }) => (
                    <div className="min-w-64">
                        <div className="font-medium">{row.original.name}</div>
                        <div className="text-muted-foreground">
                            {row.original.email}
                        </div>
                        {row.original.username && (
                            <div className="text-xs text-muted-foreground">
                                @{row.original.username}
                            </div>
                        )}
                    </div>
                ),
            },
            {
                accessorKey: 'status',
                header: 'Status',
                cell: ({ row }) => (
                    <RegistrationStatus registration={row.original} />
                ),
            },
            {
                accessorKey: 'registered_at',
                header: 'Registered',
                cell: ({ row }) => (
                    <span className="whitespace-nowrap text-muted-foreground">
                        {formatDate(row.original.registered_at)}
                    </span>
                ),
            },
            {
                id: 'deadline_resolution',
                header: 'Deadline / resolution',
                cell: ({ row }) => {
                    const registration = row.original;

                    return registration.status === 'pending' ? (
                        <div>
                            <div className="whitespace-nowrap">
                                {formatDate(
                                    registration.verification_expires_at,
                                )}
                            </div>
                            <div
                                className={
                                    registration.is_approaching_expiration
                                        ? 'text-xs font-medium text-amber-700 dark:text-amber-400'
                                        : 'text-xs text-muted-foreground'
                                }
                            >
                                {formatRemaining(
                                    registration.remaining_seconds,
                                )}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="whitespace-nowrap text-muted-foreground">
                                {formatDate(registration.resolved_at)}
                            </div>
                            {registration.decline_reason && (
                                <div className="max-w-sm text-xs text-muted-foreground">
                                    {registration.decline_reason}
                                </div>
                            )}
                        </div>
                    );
                },
                enableGlobalFilter: false,
            },
            ...(filters.view === 'pending'
                ? [
                      {
                          id: 'actions',
                          header: () => (
                              <span className="sr-only">Actions</span>
                          ),
                          cell: ({ row }) => (
                              <div className="flex justify-end gap-2">
                                  <ConfirmActionDialog
                                      trigger={
                                          <Button
                                              size="sm"
                                              disabled={
                                                  processingUserId ===
                                                  row.original.user_id
                                              }
                                          >
                                              <UserCheck />
                                              Approve
                                          </Button>
                                      }
                                      title="Approve this registration?"
                                      description={`${row.original.name} will receive the active default role and can sign in immediately.`}
                                      confirmLabel="Approve registration"
                                      processing={
                                          processingUserId ===
                                          row.original.user_id
                                      }
                                      onConfirm={() =>
                                          approveRegistration(row.original)
                                      }
                                  />
                                  <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                          declineForm.reset();
                                          setDeclining(row.original);
                                      }}
                                  >
                                      <UserX /> Decline
                                  </Button>
                              </div>
                          ),
                          enableGlobalFilter: false,
                          enableHiding: false,
                          enableSorting: false,
                      } satisfies DataTableColumnDef<RegistrationRow>,
                  ]
                : []),
        ],
        [approveRegistration, declineForm, filters.view, processingUserId],
    );

    return (
        <>
            <Head title="Registration verification" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <AdminPageHeader
                    title="Registration verification"
                    description="Review self-registered accounts before they receive any system access."
                />

                {Object.keys(errors).length > 0 && (
                    <AlertError errors={Object.values(errors)} />
                )}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        label="Pending review"
                        value={counts.pending}
                        icon={UserRoundSearch}
                    />
                    <SummaryCard
                        label="Expires within 24 hours"
                        value={counts.approaching_expiration}
                        icon={Clock3}
                        warning={counts.approaching_expiration > 0}
                    />
                    <SummaryCard
                        label="Declined"
                        value={counts.declined}
                        icon={UserX}
                    />
                    <SummaryCard
                        label="Expired and deleted"
                        value={counts.expired}
                        icon={Trash2}
                    />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Automatic verification expiration</CardTitle>
                        <CardDescription>
                            Set the deadline assigned to each new registration.
                            At the deadline, approval and login are blocked; the
                            scheduled cleanup records the expiration and deletes
                            the unverified account.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="flex flex-col gap-4 sm:flex-row sm:items-end"
                            onSubmit={(event) => {
                                event.preventDefault();
                                expirationForm.put(
                                    updateRegistrationSetting.url(),
                                    { preserveScroll: true },
                                );
                            }}
                        >
                            <div className="grid max-w-xs flex-1 gap-2">
                                <Label htmlFor="pending-expiration-days">
                                    Days before auto-decline and deletion
                                </Label>
                                <Input
                                    id="pending-expiration-days"
                                    type="number"
                                    min={1}
                                    max={3650}
                                    step={1}
                                    value={
                                        expirationForm.data
                                            .pending_expiration_days
                                    }
                                    disabled={!settings.can_manage}
                                    onChange={(event) =>
                                        expirationForm.setData(
                                            'pending_expiration_days',
                                            Number(event.target.value),
                                        )
                                    }
                                />
                                <InputError
                                    message={
                                        expirationForm.errors
                                            .pending_expiration_days
                                    }
                                />
                            </div>
                            {settings.can_manage && (
                                <Button
                                    type="submit"
                                    disabled={
                                        expirationForm.processing ||
                                        expirationForm.data
                                            .pending_expiration_days ===
                                            settings.pending_expiration_days
                                    }
                                >
                                    {expirationForm.processing
                                        ? 'Saving…'
                                        : 'Save setting'}
                                </Button>
                            )}
                        </form>
                        <p className="mt-3 text-sm text-muted-foreground">
                            The deadline is calculated from the account's exact
                            registration date and time. Changing this value
                            affects registrations submitted afterward.
                        </p>
                    </CardContent>
                </Card>

                <Card className="gap-0 overflow-hidden py-0">
                    <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap gap-2" role="tablist">
                            <ViewButton
                                active={filters.view === 'pending'}
                                onClick={() => visit('pending')}
                            >
                                Pending ({counts.pending})
                            </ViewButton>
                            <ViewButton
                                active={filters.view === 'declined'}
                                onClick={() => visit('declined')}
                            >
                                Declined ({counts.declined})
                            </ViewButton>
                            <ViewButton
                                active={filters.view === 'expired'}
                                onClick={() => visit('expired')}
                            >
                                Deleted / expired ({counts.expired})
                            </ViewButton>
                        </div>
                        <form
                            className="flex gap-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                visit(filters.view);
                            }}
                        >
                            <div className="relative min-w-0 sm:w-72">
                                <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    className="pl-9"
                                    placeholder="Search name, email, username…"
                                    aria-label="Search registrations"
                                />
                            </div>
                            <Button type="submit" variant="secondary">
                                Search
                            </Button>
                        </form>
                    </div>

                    <DataTable
                        columns={columns}
                        data={registrationRows}
                        processingMode="server"
                        showSearch={false}
                        showColumnVisibility={false}
                        showPagination={false}
                        showSelectionSummary={false}
                        tableContainerClassName="rounded-none border-x-0 border-t-0"
                        emptyState={
                            <div className="flex flex-col items-center gap-2 py-8 text-center">
                                <ShieldCheck className="size-8 text-muted-foreground" />
                                <p className="font-medium">
                                    No {viewLabel(filters.view)} registrations
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    No records match the current view and
                                    search.
                                </p>
                            </div>
                        }
                    />

                    <Pagination
                        links={registrations.links}
                        from={registrations.from}
                        to={registrations.to}
                        total={registrations.total}
                    />
                </Card>
            </div>

            <Dialog
                open={declining !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeclining(null);
                        declineForm.clearErrors();
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Decline registration?</DialogTitle>
                        <DialogDescription>
                            {declining?.name} will remain blocked and appear in
                            the declined registrations view. This action is
                            recorded in the audit log.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label htmlFor="decline-reason">
                            Reason (optional)
                        </Label>
                        <textarea
                            id="decline-reason"
                            className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            value={declineForm.data.reason}
                            maxLength={1000}
                            onChange={(event) =>
                                declineForm.setData(
                                    'reason',
                                    event.target.value,
                                )
                            }
                        />
                        <InputError message={declineForm.errors.reason} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            disabled={declineForm.processing}
                            onClick={submitDecline}
                        >
                            {declineForm.processing
                                ? 'Declining…'
                                : 'Decline registration'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function SummaryCard({
    label,
    value,
    icon: Icon,
    warning = false,
}: {
    label: string;
    value: number;
    icon: typeof Clock3;
    warning?: boolean;
}) {
    return (
        <Card className="gap-3 p-5">
            <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Icon
                    className={
                        warning
                            ? 'size-4 text-amber-600 dark:text-amber-400'
                            : 'size-4 text-muted-foreground'
                    }
                />
            </div>
            <span className="text-2xl font-semibold">{value}</span>
        </Card>
    );
}

function ViewButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <Button
            type="button"
            size="sm"
            variant={active ? 'secondary' : 'ghost'}
            role="tab"
            aria-selected={active}
            onClick={onClick}
        >
            {children}
        </Button>
    );
}

function RegistrationStatus({
    registration,
}: {
    registration: RegistrationRow;
}) {
    if (registration.status === 'expired_deleted') {
        return <Badge variant="destructive">Deleted / expired</Badge>;
    }

    if (registration.status === 'declined') {
        return <Badge variant="destructive">Declined</Badge>;
    }

    return (
        <div className="flex flex-col items-start gap-1">
            <Badge
                variant="outline"
                className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            >
                Pending verification
            </Badge>
            {registration.is_approaching_expiration && (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Approaching expiration
                </span>
            )}
        </div>
    );
}

function formatDate(value: string | null): string {
    return value
        ? new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(new Date(value))
        : 'Not available';
}

function formatRemaining(seconds: number | null): string {
    if (seconds === null) {
        return 'No deadline configured';
    }

    if (seconds <= 0) {
        return 'Expired — awaiting cleanup';
    }

    const days = Math.floor(seconds / 86400);
    const hours = Math.ceil((seconds % 86400) / 3600);

    if (days > 0) {
        return `${days}d ${hours}h remaining`;
    }

    return `${hours}h remaining`;
}

function viewLabel(view: RegistrationView): string {
    return view === 'expired' ? 'deleted / expired' : view;
}

function normalizeRegistration(
    registration: RegistrationRow | ExpiredAuditRow,
): RegistrationRow {
    if (!('metadata' in registration)) {
        return registration;
    }

    const metadata = registration.metadata ?? {};

    return {
        id: `expired-${registration.id}`,
        user_id: metadata.user_id ?? registration.subject_id ?? 'deleted',
        name: metadata.name ?? 'Deleted registration',
        email: metadata.email ?? 'Unavailable',
        status: 'expired_deleted',
        registered_at: metadata.registered_at ?? null,
        verification_expires_at: metadata.verification_expires_at ?? null,
        resolved_at: metadata.expired_at ?? registration.created_at,
        decline_reason:
            'Verification period expired; account data was deleted.',
        remaining_seconds: 0,
        is_approaching_expiration: false,
        can_review: false,
    };
}
