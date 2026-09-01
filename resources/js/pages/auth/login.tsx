import { Form, Head } from '@inertiajs/react';
import { CircleCheck } from 'lucide-react';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

export default function Login({ status, canResetPassword }: Props) {
    return (
        <>
            <Head title="Log in" />

            <div className="flex flex-col gap-6">
                {status && (
                    <Alert>
                        <CircleCheck />
                        <AlertDescription>{status}</AlertDescription>
                    </Alert>
                )}

                <Form
                    {...store.form()}
                    resetOnSuccess={['password']}
                    disableWhileProcessing
                    className="flex flex-col gap-5"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email or username</Label>
                                <Input
                                    id="email"
                                    type="text"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="username"
                                    placeholder="email@example.com or username"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">Password</Label>
                                </div>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder="Password"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    tabIndex={4}
                                />
                                <Label htmlFor="remember">Remember me</Label>
                                
                                {canResetPassword && (
                                    <TextLink
                                        href={request()}
                                        className="ml-auto text-sm"
                                        tabIndex={3}
                                    >
                                        Forgot your password?
                                    </TextLink>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                tabIndex={5}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                Log in
                            </Button>
                        </>
                    )}
                </Form>

                <PasskeyVerify
                    separator="Or continue with"
                    separatorClassName="bg-card"
                    separatorPosition="before"
                />

                <div className="text-center text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <TextLink href={register()} tabIndex={6}>
                        Sign up
                    </TextLink>
                </div>
            </div>
        </>
    );
}

Login.layout = {
    title: 'Welcome back',
    description: '',
};
