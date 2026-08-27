import type { Page } from '@inertiajs/core';
import { App, Head } from '@inertiajs/react';
import type { ResolvedComponent } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { ConnectionStatusIndicator } from '@/components/connection-status-indicator';
import { ProjectWorkspace } from '@/components/project-workspace';
import { PwaUpdatePrompt } from '@/components/pwa-update-prompt';
import { TaskWorkspace } from '@/components/task-workspace';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { getOfflineAppState } from '@/offline/app-state';
import { getActiveOfflineUser } from '@/offline/database/database';
import { dashboard, projects } from '@/routes';
import type { User } from '@/types';
import type { PermissionScope } from '@/types';
import '../css/app.css';

const rootElement = document.getElementById('offline-app');

if (!rootElement) {
    throw new Error('The offline application root element is missing.');
}

const userScope = getActiveOfflineUser();
const rememberedState = getOfflineAppState(userScope);
const isProjectsPage = /^\/projects(?:\/|$)/.test(window.location.pathname);
const appName =
    rememberedState?.name ?? import.meta.env.VITE_APP_NAME ?? 'Laravel';
const user = rememberedState?.user ?? fallbackUser(userScope);
const pages = import.meta.glob<{ default: ResolvedComponent }>(
    './pages/**/*.tsx',
);

const initialPage: Page<{
    name: string;
    auth: {
        user: User;
        permissions: Record<string, PermissionScope>;
        roles: string[];
    };
    sidebarOpen: boolean;
}> = {
    component: isProjectsPage ? 'project' : 'dashboard',
    props: {
        name: appName,
        auth: {
            user,
            permissions: rememberedState?.permissions ?? {},
            roles: [],
        },
        sidebarOpen: rememberedSidebarState(
            rememberedState?.sidebarOpen ?? true,
        ),
        errors: {},
    },
    url: `${window.location.pathname}${window.location.search}`,
    version: null,
    rescuedProps: [],
    flash: {},
    rememberedState: {},
};

function OfflineDashboard() {
    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col overflow-x-auto rounded-xl p-4">
                {userScope ? (
                    <TaskWorkspace userScope={userScope} />
                ) : (
                    <Card className="mx-auto w-full max-w-3xl">
                        <CardHeader>
                            <CardTitle>Offline-first tasks</CardTitle>
                            <CardDescription>
                                Local task data becomes available after the
                                first authenticated dashboard visit.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Sign in while online and open the dashboard once
                                to activate this browser’s offline workspace.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}

OfflineDashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};

function OfflineProjects() {
    return (
        <>
            <Head title="Projects" />
            <div className="flex h-full flex-1 flex-col overflow-x-auto rounded-xl p-4">
                {userScope ? (
                    <ProjectWorkspace userScope={userScope} />
                ) : (
                    <Card className="mx-auto w-full max-w-3xl">
                        <CardHeader>
                            <CardTitle>Offline-first projects</CardTitle>
                            <CardDescription>
                                Local project data becomes available after the
                                first authenticated Projects visit.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Sign in while online and open Projects once to
                                activate this browser&apos;s offline workspace.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}

OfflineProjects.layout = {
    breadcrumbs: [
        {
            title: 'Projects',
            href: projects(),
        },
    ],
};

async function resolveComponent(name: string): Promise<ResolvedComponent> {
    const page = await resolvePageComponent<{ default: ResolvedComponent }>(
        `./pages/${name}.tsx`,
        pages,
    );

    return page.default;
}

initializeTheme();

createRoot(rootElement).render(
    <TooltipProvider delayDuration={0}>
        <App
            initialPage={initialPage}
            initialComponent={
                (isProjectsPage
                    ? OfflineProjects
                    : OfflineDashboard) as unknown as ResolvedComponent
            }
            resolveComponent={resolveComponent}
            titleCallback={(title) =>
                title ? `${title} - ${appName}` : appName
            }
            defaultLayout={(name) => {
                switch (true) {
                    case name === 'welcome':
                        return null;
                    case name.startsWith('auth/'):
                        return AuthLayout;
                    case name.startsWith('settings/'):
                        return [AppLayout, SettingsLayout];
                    default:
                        return AppLayout;
                }
            }}
        />
        <ConnectionStatusIndicator />
        <PwaUpdatePrompt />
        <Toaster />
    </TooltipProvider>,
);

function fallbackUser(userScope: string | null): User {
    const id = Number(userScope);

    return {
        id: Number.isSafeInteger(id) ? id : 0,
        name: 'Offline user',
        email: '',
        email_verified_at: null,
        created_at: '',
        updated_at: '',
    };
}

function rememberedSidebarState(fallback: boolean): boolean {
    const cookie = document.cookie
        .split('; ')
        .find((candidate) => candidate.startsWith('sidebar_state='));

    if (!cookie) {
        return fallback;
    }

    return cookie.slice('sidebar_state='.length) !== 'false';
}
