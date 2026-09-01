import { Link, usePage } from '@inertiajs/react';
import {
    BookOpen,
    FolderGit2,
    FolderKanban,
    Database,
    KeyRound,
    LayoutGrid,
    ListTodo,
    ScrollText,
    ShieldCheck,
    UserRoundCheck,
    Users,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { clampSidebarLogoSize } from '@/lib/branding';
import { toUrl } from '@/lib/utils';
import { useIsOffline } from '@/offline/connection-status';
import { dashboard, projects, tasks } from '@/routes';
import { index as auditLogs } from '@/routes/admin/audit-logs';
import { index as permissions } from '@/routes/admin/permissions';
import { index as registrations } from '@/routes/admin/registrations';
import { index as roles } from '@/routes/admin/roles';
import { index as users } from '@/routes/admin/users';
import { index as workspaceData } from '@/routes/admin/workspace-data';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
        permission: 'dashboard.view',
    },
    {
        title: 'Offline-first Tasks',
        href: tasks(),
        icon: ListTodo,
        permission: 'tasks.view',
    },
    {
        title: 'Projects',
        href: projects(),
        icon: FolderKanban,
        permission: 'projects.view',
    },
];

const administrationNavItems: NavItem[] = [
    {
        title: 'Workspace data',
        href: workspaceData(),
        icon: Database,
        permission: 'workspace.view-all',
        requiresOnline: true,
    },
    {
        title: 'Users',
        href: users(),
        icon: Users,
        permission: 'users.view',
        requiresOnline: true,
    },
    {
        title: 'Registration verification',
        href: registrations(),
        icon: UserRoundCheck,
        permission: 'users.verify-registrations',
        requiresOnline: true,
    },
    {
        title: 'Roles',
        href: roles(),
        icon: ShieldCheck,
        permission: 'roles.view',
        requiresOnline: true,
    },
    {
        title: 'Permissions',
        href: permissions(),
        icon: KeyRound,
        permission: 'permissions.manage',
        requiresOnline: true,
    },
    {
        title: 'Audit logs',
        href: auditLogs(),
        icon: ScrollText,
        permission: 'audit-logs.view',
        requiresOnline: true,
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Repository',
        href: 'https://github.com/laravel/react-starter-kit',
        icon: FolderGit2,
    },
    {
        title: 'Documentation',
        href: 'https://laravel.com/docs/starter-kits#react',
        icon: BookOpen,
    },
];

export function AppSidebar() {
    const isOffline = useIsOffline();
    const { auth, branding } = usePage().props;
    const allowed = (item: NavItem) =>
        !item.permission || item.permission in auth.permissions;
    const allowedAdministrationItems = administrationNavItems
        .filter(allowed)
        .map((item): NavItem => {
            if (
                item.permission !== 'users.verify-registrations' ||
                auth.pending_registration_count < 1
            ) {
                return item;
            }

            const pendingCount = auth.pending_registration_count;

            return {
                ...item,
                badge: pendingCount > 99 ? '99+' : pendingCount,
                badgeLabel: `${pendingCount} pending registration${pendingCount === 1 ? '' : 's'}`,
            };
        });

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            asChild
                            className="h-auto min-h-[var(--sidebar-brand-min-height)] py-2 group-data-[collapsible=icon]:min-h-12!"
                            style={
                                {
                                    '--sidebar-brand-min-height': `${Math.max(
                                        branding.layout === 'vertical' ||
                                            branding.titleOverflow === 'wrap'
                                            ? 64
                                            : 48,
                                        clampSidebarLogoSize(
                                            branding.sidebarLogoSize,
                                        ) + 16,
                                    )}px`,
                                } as CSSProperties
                            }
                        >
                            <Link
                                href={dashboard()}
                                prefetch
                                onClick={(event) => {
                                    if (!isOffline) {
                                        return;
                                    }

                                    event.preventDefault();
                                    window.location.assign(toUrl(dashboard()));
                                }}
                            >
                                <AppLogo sidebar />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems.filter(allowed)} />
                {allowedAdministrationItems.length > 0 && (
                    <NavMain
                        label="Administration"
                        items={allowedAdministrationItems}
                    />
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
