import { usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { clampSidebarLogoSize } from '@/lib/branding';
import { cn } from '@/lib/utils';
import type { Branding } from '@/types';

export default function AppLogo({
    branding: brandingOverride,
    preview = false,
    sidebar = false,
    className,
}: {
    branding?: Branding;
    preview?: boolean;
    sidebar?: boolean;
    className?: string;
}) {
    const { branding: sharedBranding } = usePage().props;
    const branding = brandingOverride ?? sharedBranding;
    const showLogo = branding.layout !== 'title-only';
    const showTitle = branding.layout !== 'logo-only';
    const isVertical = branding.layout === 'vertical';
    const customLogoUrl = branding.usesCustomLogo ? branding.logoUrl : null;
    const titleAlignment = branding.titleAlignment ?? 'left';
    const titleOverflow = branding.titleOverflow ?? 'ellipsis';
    const sidebarLogoSize = clampSidebarLogoSize(branding.sidebarLogoSize);
    const logoSize = sidebar ? sidebarLogoSize : preview ? 40 : 32;
    const defaultIconSize = Math.round(logoSize * 0.625);
    const sidebarWidthCap =
        isVertical || !showTitle ? '100%' : 'calc(100% - 0.5rem)';

    return (
        <div
            className={cn(
                'flex w-full min-w-0 items-center',
                isVertical ? 'flex-col justify-center gap-1' : 'gap-2',
                className,
            )}
        >
            {showLogo && (
                <div
                    className={cn(
                        'flex shrink-0 items-center justify-center overflow-hidden rounded-md',
                        sidebar && 'aspect-square max-w-full',
                        sidebar && 'group-data-[collapsible=icon]:size-8!',
                        !customLogoUrl &&
                            'bg-sidebar-primary text-sidebar-primary-foreground',
                    )}
                    style={
                        sidebar
                            ? {
                                  width: `min(${sidebarLogoSize}px, ${sidebarWidthCap})`,
                              }
                            : { width: logoSize, height: logoSize }
                    }
                >
                    {customLogoUrl ? (
                        <img
                            src={customLogoUrl}
                            alt={showTitle ? '' : `${branding.systemName} logo`}
                            className="size-full object-contain"
                        />
                    ) : (
                        <AppLogoIcon
                            className={cn(
                                'fill-current text-sidebar-primary-foreground',
                                sidebar &&
                                    'group-data-[collapsible=icon]:size-5!',
                            )}
                            style={{
                                width: sidebar ? '62.5%' : defaultIconSize,
                                height: sidebar ? '62.5%' : defaultIconSize,
                            }}
                        />
                    )}
                </div>
            )}
            {showTitle && (
                <div
                    className={cn(
                        'grid min-w-0 flex-1 text-sm group-data-[collapsible=icon]:hidden',
                        isVertical && 'w-full',
                        titleAlignment === 'left' && 'text-left',
                        titleAlignment === 'center' && 'text-center',
                        titleAlignment === 'right' && 'text-right',
                    )}
                >
                    <span
                        className={cn(
                            'block leading-tight font-semibold',
                            titleOverflow === 'ellipsis' && 'truncate',
                            titleOverflow === 'clip' &&
                                'overflow-hidden text-clip whitespace-nowrap',
                            titleOverflow === 'wrap' &&
                                'break-words whitespace-normal',
                            preview && 'max-w-48',
                        )}
                    >
                        {branding.systemName || 'System name'}
                    </span>
                </div>
            )}
            {branding.layout === 'title-only' && (
                <span
                    aria-hidden="true"
                    className="hidden size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground group-data-[collapsible=icon]:flex"
                >
                    {branding.systemName.trim().charAt(0).toUpperCase() || 'S'}
                </span>
            )}
            {!showLogo && !showTitle && (
                <span className="sr-only">{branding.systemName}</span>
            )}
        </div>
    );
}
