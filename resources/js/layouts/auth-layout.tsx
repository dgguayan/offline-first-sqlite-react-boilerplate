import { usePage } from '@inertiajs/react';
import AuthLoginLayout from '@/layouts/auth/auth-login-layout';
import AuthLayoutTemplate from '@/layouts/auth/auth-simple-layout';
import type { AuthLayoutProps } from '@/types';

export default function AuthLayout({
    title = '',
    description = '',
    children,
}: AuthLayoutProps) {
    const isLoginPage = usePage().component === 'auth/login';

    if (isLoginPage) {
        return (
            <AuthLoginLayout title={title} description={description}>
                {children}
            </AuthLoginLayout>
        );
    }

    return (
        <AuthLayoutTemplate title={title} description={description}>
            {children}
        </AuthLayoutTemplate>
    );
}
