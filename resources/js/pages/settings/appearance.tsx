import { Head, usePage } from '@inertiajs/react';
import AppearanceTabs from '@/components/appearance-tabs';
import Heading from '@/components/heading';
import { SystemBrandingSettings } from '@/components/system-branding-settings';
import { Separator } from '@/components/ui/separator';
import { edit as editAppearance } from '@/routes/appearance';

export default function Appearance() {
    const { auth, branding } = usePage().props;
    const canManageBranding = 'settings.manage-branding' in auth.permissions;

    return (
        <>
            <Head title="Appearance settings" />

            <h1 className="sr-only">Appearance settings</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Appearance settings"
                    description="Update the appearance settings for your account"
                />
                <AppearanceTabs />

                {canManageBranding && (
                    <>
                        <Separator />
                        <SystemBrandingSettings
                            key={branding.updatedAt ?? 'default'}
                            branding={branding}
                        />
                    </>
                )}
            </div>
        </>
    );
}

Appearance.layout = {
    breadcrumbs: [
        {
            title: 'Appearance settings',
            href: editAppearance(),
        },
    ],
};
