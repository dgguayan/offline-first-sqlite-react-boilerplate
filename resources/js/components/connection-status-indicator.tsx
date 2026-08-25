import { useIsOffline } from '@/offline/connection-status';

export function ConnectionStatusIndicator() {
    const isOffline = useIsOffline();

    if (!isOffline) {
        return null;
    }

    return (
        <div
            className="pointer-events-none fixed top-4 right-4 z-60 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
            role="status"
            aria-live="polite"
        >
            Offline
        </div>
    );
}
