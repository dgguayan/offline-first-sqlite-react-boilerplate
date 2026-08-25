import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

export function PwaUpdatePrompt() {
    if (typeof navigator === 'undefined') {
        return null;
    }

    return <RegisteredPwaUpdatePrompt />;
}

function RegisteredPwaUpdatePrompt() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        offlineReady: [offlineReady, setOfflineReady],
        updateServiceWorker,
    } = useRegisterSW();

    if (!needRefresh && !offlineReady) {
        return null;
    }

    const dismiss = () => {
        setNeedRefresh(false);
        setOfflineReady(false);
    };

    return (
        <div
            className="fixed right-4 bottom-4 z-50 max-w-sm rounded-xl border bg-background p-4 text-foreground shadow-lg"
            role="status"
        >
            <p className="text-sm font-medium">
                {needRefresh
                    ? 'A new version is ready.'
                    : 'The app is ready to work offline.'}
            </p>
            <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={dismiss}>
                    Dismiss
                </Button>
                {needRefresh && (
                    <Button
                        size="sm"
                        onClick={() => void updateServiceWorker()}
                    >
                        Update
                    </Button>
                )}
            </div>
        </div>
    );
}
