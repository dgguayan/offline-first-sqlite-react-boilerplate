import { Link, usePage } from '@inertiajs/react';
import AppLogo from '@/components/app-logo';
import { Card, CardContent } from '@/components/ui/card';
import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthLoginLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { branding } = usePage().props;
    const supportingText =
        description || `Sign in to your ${branding.systemName} account.`;

    return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-4 sm:p-6 md:p-10">
            <div className="w-full max-w-sm md:max-w-4xl">
                <Card className="overflow-hidden p-0">
                    <CardContent className="grid p-0 md:grid-cols-2">
                        <section className="flex min-h-[32rem] flex-col justify-center p-6 sm:p-8 md:p-10">
                            <div className="mx-auto w-full max-w-sm">
                                <Link
                                    href={home()}
                                    className="mx-auto mb-8 flex w-full max-w-52 justify-center rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none md:hidden"
                                >
                                    <AppLogo preview />
                                    <span className="sr-only">Go to home</span>
                                </Link>

                                <div className="mb-7 space-y-2 text-center">
                                    <h1 className="text-2xl font-bold tracking-tight">
                                        {title}
                                    </h1>
                                    <p className="text-sm text-balance text-muted-foreground">
                                        {supportingText}
                                    </p>
                                </div>

                                {children}
                            </div>
                        </section>

                        <aside className="relative hidden min-h-[32rem] items-center justify-center overflow-hidden border-l bg-muted/60 p-10 md:flex">
                            <PlaceholderPattern className="absolute inset-0 size-full stroke-border opacity-60" />
                            <div className="absolute size-72 rounded-full border border-border/70" />
                            <div className="absolute size-52 rounded-full border border-border/70" />
                            <div className="absolute size-32 rounded-full border border-border/70" />

                            <Link
                                href={home()}
                                className="relative z-10 flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border bg-card/90 p-7 shadow-sm backdrop-blur-sm transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                            >
                                <AppLogo
                                    preview
                                    className="max-w-60 justify-center"
                                />
                                <p className="text-center text-sm text-muted-foreground">
                                    Secure access for approved accounts.
                                </p>
                                <span className="sr-only">Go to home</span>
                            </Link>
                        </aside>
                    </CardContent>
                </Card>

                <p className="mt-6 text-center text-xs text-balance text-muted-foreground">
                    Accounts must be approved before they can access the system.
                </p>
            </div>
        </div>
    );
}
