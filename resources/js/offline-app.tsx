import { createRoot } from 'react-dom/client';
import { PwaUpdatePrompt } from '@/components/pwa-update-prompt';
import { TaskWorkspace } from '@/components/task-workspace';
import { getActiveOfflineUser } from '@/offline/database/database';
import '../css/app.css';

const rootElement = document.getElementById('offline-app');

if (!rootElement) {
    throw new Error('The offline application root element is missing.');
}

const userScope = getActiveOfflineUser();

createRoot(rootElement).render(
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
        <div className="mx-auto mb-5 max-w-3xl">
            <p className="text-sm font-medium">Offline workspace</p>
            <p className="mt-1 text-sm text-muted-foreground">
                Laravel is unreachable. This static shell is using only local
                browser data.
            </p>
        </div>
        {userScope ? (
            <TaskWorkspace userScope={userScope} />
        ) : (
            <div className="mx-auto max-w-3xl rounded-xl border bg-background p-6 shadow-sm">
                <h1 className="font-semibold">No offline user is active</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Sign in while online and open the dashboard once before
                    using the offline workspace.
                </p>
            </div>
        )}
        <PwaUpdatePrompt />
    </main>,
);
