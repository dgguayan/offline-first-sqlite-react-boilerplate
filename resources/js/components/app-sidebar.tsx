import { Link, usePage } from '@inertiajs/react';
import {
    BookOpen,
    FolderGit2,
    FolderKanban,
    Database,
    KeyRound,
    LayoutGrid,
    ScrollText,
    ShieldCheck,
    Users,
} from 'lucide-react';
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
import { toUrl } from '@/lib/utils';
import { useIsOffline } from '@/offline/connection-status';
import { dashboard, projects } from '@/routes';
import { index as auditLogs } from '@/routes/admin/audit-logs';
import { index as permissions } from '@/routes/admin/permissions';
import { index as roles } from '@/routes/admin/roles';
import { index as users } from '@/routes/admin/users';
import { index as workspaceData } from '@/routes/admin/workspace-data';
import type { Auth, NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
        permission: 'dashboard.view',
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
    const { auth } = usePage<{ auth: Auth }>().props;
    const allowed = (item: NavItem) =>
        !item.permission || item.permission in auth.permissions;

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
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
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems.filter(allowed)} />
                {administrationNavItems.some(allowed) && (
                    <NavMain
                        label="Administration"
                        items={administrationNavItems.filter(allowed)}
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
