import { Link } from '@inertiajs/react';
import { toast } from 'sonner';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { toUrl } from '@/lib/utils';
import { useIsOffline } from '@/offline/connection-status';
import type { NavItem } from '@/types';

export function NavMain({
    items = [],
    label = 'Platform',
}: {
    items: NavItem[];
    label?: string;
}) {
    const { isCurrentUrl } = useCurrentUrl();
    const isOffline = useIsOffline();

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            asChild
                            isActive={isCurrentUrl(item.href)}
                            tooltip={{ children: item.title }}
                        >
                            <Link
                                href={item.href}
                                prefetch
                                onClick={(event) => {
                                    if (isOffline && item.requiresOnline) {
                                        event.preventDefault();
                                        toast.info(
                                            'This administration page requires an internet connection.',
                                        );

                                        return;
                                    }

                                    if (
                                        !isOffline ||
                                        event.button !== 0 ||
                                        event.metaKey ||
                                        event.ctrlKey ||
                                        event.shiftKey ||
                                        event.altKey
                                    ) {
                                        return;
                                    }

                                    event.preventDefault();
                                    window.location.assign(toUrl(item.href));
                                }}
                            >
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                        {item.badge !== undefined && (
                            <SidebarMenuBadge
                                role="status"
                                aria-label={item.badgeLabel}
                                title={item.badgeLabel}
                                className="bg-sidebar-primary text-sidebar-primary-foreground ring-1 ring-sidebar-border group-data-[collapsible=icon]:top-0 group-data-[collapsible=icon]:right-0 group-data-[collapsible=icon]:flex! group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:min-w-4 group-data-[collapsible=icon]:px-0.5 group-data-[collapsible=icon]:text-[10px]"
                            >
                                {item.badge}
                            </SidebarMenuBadge>
                        )}
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
