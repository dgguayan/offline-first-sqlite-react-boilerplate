import { Form, Head, Link } from '@inertiajs/react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { index, store } from '@/routes/admin/users';

export default function CreateUser() {
    return (
        <>
            <Head title="Create user" />
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:p-6">
                <AdminPageHeader
                    title="Create user"
                    description="Create an account with a secure initial password. The default role is assigned automatically."
                />
                <Form {...store.form()} className="space-y-6">
                    {({ processing, errors }) => (
                        <>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Account information</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-5 md:grid-cols-2">
                                    <Field
                                        label="Full name"
                                        name="name"
                                        error={errors.name}
                                        required
                                    />
                                    <Field
                                        label="Username"
                                        name="username"
                                        error={errors.username}
                                        placeholder="optional-username"
                                    />
                                    <Field
                                        label="Email address"
                                        name="email"
                                        type="email"
                                        error={errors.email}
                                        required
                                    />
                                    <div className="grid gap-2">
                                        <Label htmlFor="status">Status</Label>
                                        <select
                                            id="status"
                                            name="status"
                                            defaultValue="active"
                                            className="h-9 rounded-md border bg-background px-3 text-sm"
                                        >
                                            <option value="active">
                                                Active
                                            </option>
                                            <option value="inactive">
                                                Inactive
                                            </option>
                                        </select>
                                        <InputError message={errors.status} />
                                    </div>
                                    <Field
                                        label="Job title"
                                        name="job_title"
                                        error={errors.job_title}
                                    />
                                    <Field
                                        label="Department"
                                        name="department"
                                        error={errors.department}
                                    />
                                    <Field
                                        label="Phone"
                                        name="phone"
                                        error={errors.phone}
                                    />
                                    <div className="grid gap-2 md:col-span-2">
                                        <Label htmlFor="bio">
                                            Profile / bio
                                        </Label>
                                        <textarea
                                            id="bio"
                                            name="bio"
                                            rows={4}
                                            className="rounded-md border bg-background px-3 py-2 text-sm"
                                        />
                                        <InputError message={errors.bio} />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Initial password</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-5 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="password">
                                            Password
                                        </Label>
                                        <PasswordInput
                                            id="password"
                                            name="password"
                                            required
                                        />
                                        <InputError message={errors.password} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="password_confirmation">
                                            Confirm password
                                        </Label>
                                        <PasswordInput
                                            id="password_confirmation"
                                            name="password_confirmation"
                                            required
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                            <div className="flex justify-end gap-2">
                                <Button asChild variant="outline">
                                    <Link href={index()}>Cancel</Link>
                                </Button>
                                <Button disabled={processing}>
                                    {processing ? 'Creating…' : 'Create user'}
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

function Field({
    label,
    name,
    error,
    type = 'text',
    required = false,
    placeholder,
}: {
    label: string;
    name: string;
    error?: string;
    type?: string;
    required?: boolean;
    placeholder?: string;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={name}>{label}</Label>
            <Input
                id={name}
                name={name}
                type={type}
                required={required}
                placeholder={placeholder}
            />
            <InputError message={error} />
        </div>
    );
}
