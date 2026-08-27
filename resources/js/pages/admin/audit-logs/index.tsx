import { Head, router } from '@inertiajs/react';
import { Search, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Pagination } from '@/components/admin/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { index } from '@/routes/admin/audit-logs';
import type { Paginated } from '@/types';

type AuditLog = {
    id: number;
    event: string;
    actor: { id: number; name: string; email: string } | null;
    subject_type: string | null;
    subject_id: string | null;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
};

type Props = {
    logs: Paginated<AuditLog>;
    actors: { id: number; name: string }[];
    events: string[];
    filters: {
        search?: string;
        event?: string;
        actor?: string;
        date_from?: string;
        date_to?: string;
    };
};

export default function AuditLogs({ logs, actors, events, filters }: Props) {
    const [values, setValues] = useState({
        search: filters.search ?? '',
        event: filters.event ?? '',
        actor: filters.actor ?? '',
        date_from: filters.date_from ?? '',
        date_to: filters.date_to ?? '',
    });

    return (
        <>
            <Head title="Audit logs" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <AdminPageHeader
                    title="Audit logs"
                    description="Review immutable security-sensitive administrative activity, including before and after values."
                />
                <Card className="gap-0 overflow-hidden py-0">
                    <form
                        className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-[1fr_220px_200px_160px_160px_auto]"
                        onSubmit={(event) => {
                            event.preventDefault();
                            router.get(index(), values, {
                                preserveState: true,
                                replace: true,
                            });
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
                                placeholder="Search event, actor, subject…"
                            />
                        </div>
                        <select
                            value={values.event}
                            onChange={(event) =>
                                setValues({
                                    ...values,
                                    event: event.target.value,
                                })
                            }
                            className="h-9 rounded-md border bg-background px-3 text-sm"
                        >
                            <option value="">All events</option>
                            {events.map((event) => (
                                <option key={event} value={event}>
                                    {event}
                                </option>
                            ))}
                        </select>
                        <select
                            value={values.actor}
                            onChange={(event) =>
                                setValues({
                                    ...values,
                                    actor: event.target.value,
                                })
                            }
                            className="h-9 rounded-md border bg-background px-3 text-sm"
                        >
                            <option value="">All actors</option>
                            {actors.map((actor) => (
                                <option key={actor.id} value={actor.id}>
                                    {actor.name}
                                </option>
                            ))}
                        </select>
                        <Input
                            type="date"
                            value={values.date_from}
                            onChange={(event) =>
                                setValues({
                                    ...values,
                                    date_from: event.target.value,
                                })
                            }
                            aria-label="From date"
                        />
                        <Input
                            type="date"
                            value={values.date_to}
                            onChange={(event) =>
                                setValues({
                                    ...values,
                                    date_to: event.target.value,
                                })
                            }
                            aria-label="To date"
                        />
                        <Button variant="secondary">Filter</Button>
                    </form>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-4 py-3">When</th>
                                    <th className="px-4 py-3">Actor</th>
                                    <th className="px-4 py-3">Event</th>
                                    <th className="px-4 py-3">
                                        Affected record
                                    </th>
                                    <th className="px-4 py-3">Context</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {logs.data.map((log) => (
                                    <tr
                                        key={log.id}
                                        className="align-top hover:bg-muted/30"
                                    >
                                        <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                                            {formatDate(log.created_at)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-medium">
                                                {log.actor?.name ?? 'System'}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {log.actor?.email}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <Badge variant="outline">
                                                {log.event}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-xs">
                                                {shortClass(log.subject_type) ??
                                                    '—'}
                                            </div>
                                            {log.subject_id && (
                                                <code className="text-xs text-muted-foreground">
                                                    #{log.subject_id}
                                                </code>
                                            )}
                                        </td>
                                        <td className="min-w-72 px-4 py-4">
                                            <details>
                                                <summary className="cursor-pointer text-sm font-medium">
                                                    View changes
                                                </summary>
                                                <div className="mt-3 grid gap-3">
                                                    <JsonBlock
                                                        label="Previous"
                                                        value={log.old_values}
                                                    />
                                                    <JsonBlock
                                                        label="New"
                                                        value={log.new_values}
                                                    />
                                                    <JsonBlock
                                                        label="Metadata"
                                                        value={log.metadata}
                                                    />
                                                    <div className="text-xs text-muted-foreground">
                                                        <div>
                                                            IP:{' '}
                                                            {log.ip_address ??
                                                                'Unavailable'}
                                                        </div>
                                                        <div className="mt-1 break-all">
                                                            Device:{' '}
                                                            {log.user_agent ??
                                                                'Unavailable'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </details>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {logs.data.length === 0 && (
                        <div className="flex flex-col items-center gap-2 p-16 text-center">
                            <ScrollText className="size-8 text-muted-foreground" />
                            <p className="font-medium">No audit events found</p>
                            <p className="text-sm text-muted-foreground">
                                Administrative and authentication events will
                                appear here.
                            </p>
                        </div>
                    )}
                    <Pagination
                        links={logs.links}
                        from={logs.from}
                        to={logs.to}
                        total={logs.total}
                    />
                </Card>
            </div>
        </>
    );
}

function JsonBlock({
    label,
    value,
}: {
    label: string;
    value: Record<string, unknown> | null;
}) {
    if (!value || Object.keys(value).length === 0) {
        return null;
    }

    return (
        <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
                {label}
            </div>
            <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                {JSON.stringify(value, null, 2)}
            </pre>
        </div>
    );
}

function shortClass(value: string | null): string | null {
    return value?.split('\\').at(-1) ?? null;
}
function formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
