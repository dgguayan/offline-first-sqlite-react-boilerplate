import { createInertiaApp, router } from '@inertiajs/react';
import { ConnectionStatusIndicator } from '@/components/connection-status-indicator';
import { PwaUpdatePrompt } from '@/components/pwa-update-prompt';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import type { Branding } from '@/types';

let appName = document.title || import.meta.env.VITE_APP_NAME || 'Laravel';

router.on('navigate', (event) => {
    const page = (event as CustomEvent).detail?.page as
        { props?: { branding?: Branding } } | undefined;
    const nextAppName = page?.props?.branding?.systemName;

    if (!nextAppName || nextAppName === appName) {
        return;
    }

    const previousAppName = appName;
    appName = nextAppName;

    if (document.title === previousAppName) {
        document.title = appName;

        return;
    }

    const previousSuffix = ` - ${previousAppName}`;

    if (document.title.endsWith(previousSuffix)) {
        document.title = `${document.title.slice(0, -previousSuffix.length)} - ${appName}`;
    }
});

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
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
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <ConnectionStatusIndicator />
                <PwaUpdatePrompt />
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
