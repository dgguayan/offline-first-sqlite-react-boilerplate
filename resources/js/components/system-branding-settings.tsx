import { useForm } from '@inertiajs/react';
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Check,
    Crop,
    RefreshCcw,
    Save,
    ScissorsLineDashed,
    Trash2,
    UploadCloud,
    WrapText,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import AppLogo from '@/components/app-logo';
import InputError from '@/components/input-error';
import { LogoImageEditor } from '@/components/logo-image-editor';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
    clampSidebarLogoSize,
    parseSidebarLogoSizeInput,
} from '@/lib/branding';
import { cn } from '@/lib/utils';
import { reset, update } from '@/routes/branding';
import {
    defaultSidebarLogoSize,
    maximumSidebarLogoSize,
    minimumSidebarLogoSize,
} from '@/types';
import type {
    Branding,
    BrandingLayout,
    BrandingTitleAlignment,
    BrandingTitleOverflow,
} from '@/types';

const maximumLogoSize = 2 * 1024 * 1024;
const acceptedLogoTypes = new Set([
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/webp',
]);
const acceptedLogoExtensions = new Set(['png', 'jpg', 'jpeg', 'svg', 'webp']);

const layoutOptions: Array<{
    value: BrandingLayout;
    title: string;
    description: string;
}> = [
    {
        value: 'horizontal',
        title: 'Horizontal',
        description: 'Logo left, title right',
    },
    {
        value: 'vertical',
        title: 'Vertical',
        description: 'Logo above the title',
    },
    {
        value: 'logo-only',
        title: 'Logo only',
        description: 'Hide the system title',
    },
    {
        value: 'title-only',
        title: 'Title only',
        description: 'Hide the system logo',
    },
];

const alignmentOptions: Array<{
    value: BrandingTitleAlignment;
    title: string;
    icon: typeof AlignLeft;
}> = [
    { value: 'left', title: 'Left', icon: AlignLeft },
    { value: 'center', title: 'Centered', icon: AlignCenter },
    { value: 'right', title: 'Right', icon: AlignRight },
];

const overflowOptions: Array<{
    value: BrandingTitleOverflow;
    title: string;
    description: string;
    icon: typeof ScissorsLineDashed;
}> = [
    {
        value: 'ellipsis',
        title: 'Ellipsis',
        description: 'Shorten with … when space runs out',
        icon: ScissorsLineDashed,
    },
    {
        value: 'clip',
        title: 'Cut',
        description: 'Hide text beyond the available space',
        icon: ScissorsLineDashed,
    },
    {
        value: 'wrap',
        title: 'Show whole title',
        description: 'Wrap onto more lines when needed',
        icon: WrapText,
    },
];

type BrandingForm = {
    system_name: string;
    layout: BrandingLayout;
    title_alignment: BrandingTitleAlignment;
    title_overflow: BrandingTitleOverflow;
    sidebar_logo_size: number;
    logo: File | null;
    remove_logo: boolean;
};

export function SystemBrandingSettings({ branding }: { branding: Branding }) {
    const fileInput = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorSource, setEditorSource] = useState<{
        url: string;
        name: string;
        owned: boolean;
    } | null>(null);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [sidebarLogoSizeInput, setSidebarLogoSizeInput] = useState(
        String(branding.sidebarLogoSize),
    );
    const [sidebarLogoSizeError, setSidebarLogoSizeError] = useState<
        string | null
    >(null);
    const form = useForm<BrandingForm>({
        system_name: branding.systemName,
        layout: branding.layout,
        title_alignment: branding.titleAlignment,
        title_overflow: branding.titleOverflow,
        sidebar_logo_size: branding.sidebarLogoSize,
        logo: null,
        remove_logo: false,
    }).dontRemember('logo');
    const resetForm = useForm({});

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const previewBranding: Branding = {
        ...branding,
        systemName: form.data.system_name,
        logoUrl: form.data.remove_logo
            ? null
            : (previewUrl ?? branding.logoUrl),
        layout: form.data.layout,
        titleAlignment: form.data.title_alignment,
        titleOverflow: form.data.title_overflow,
        sidebarLogoSize: form.data.sidebar_logo_size,
        usesCustomLogo:
            !form.data.remove_logo &&
            Boolean(previewUrl || branding.usesCustomLogo),
        isDefault: false,
    };

    const selectLogo = (file: File | undefined) => {
        if (!file) {
            return;
        }

        const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

        if (
            !acceptedLogoTypes.has(file.type) ||
            !acceptedLogoExtensions.has(extension)
        ) {
            form.setError(
                'logo',
                'Choose a PNG, JPG, JPEG, SVG, or WebP image.',
            );
            resetFileInput();

            return;
        }

        if (file.size > maximumLogoSize) {
            form.setError('logo', 'The logo must not be larger than 2 MB.');
            resetFileInput();

            return;
        }

        form.clearErrors('logo');
        setEditorSource({
            url: URL.createObjectURL(file),
            name: file.name,
            owned: true,
        });
        setEditorOpen(true);
    };

    const changeEditorOpen = (open: boolean) => {
        setEditorOpen(open);

        if (!open) {
            if (editorSource?.owned) {
                URL.revokeObjectURL(editorSource.url);
            }

            setEditorSource(null);
            resetFileInput();
        }
    };

    const applyEditedLogo = (file: File) => {
        form.clearErrors('logo');
        setPreviewUrl(URL.createObjectURL(file));
        form.setData({
            ...form.data,
            logo: file,
            remove_logo: false,
        });
    };

    const editCurrentLogo = () => {
        const currentUrl = previewUrl ?? branding.logoUrl;

        if (!currentUrl) {
            return;
        }

        setEditorSource({
            url: currentUrl,
            name: form.data.logo?.name ?? 'system-logo.png',
            owned: false,
        });
        setEditorOpen(true);
    };

    const removeLogo = () => {
        form.clearErrors('logo');
        setPreviewUrl(null);
        form.setData({
            ...form.data,
            logo: null,
            remove_logo: true,
        });
        resetFileInput();
    };

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.post(update.url(), {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
        selectLogo(event.target.files?.[0]);
    };

    const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsDragging(false);
        selectLogo(event.dataTransfer.files[0]);
    };

    const resetFileInput = () => {
        if (fileInput.current) {
            fileInput.current.value = '';
        }
    };

    const setSidebarLogoSize = (size: number) => {
        setSidebarLogoSizeInput(String(size));
        setSidebarLogoSizeError(null);
        form.clearErrors('sidebar_logo_size');
        form.setData('sidebar_logo_size', size);
    };

    const changeSidebarLogoSizeInput = (value: string) => {
        setSidebarLogoSizeInput(value);

        const parsedSize = parseSidebarLogoSizeInput(value);

        if (parsedSize === null) {
            setSidebarLogoSizeError(
                `Enter a whole number from ${minimumSidebarLogoSize} to ${maximumSidebarLogoSize} px.`,
            );

            return;
        }

        setSidebarLogoSize(parsedSize);
    };

    const commitSidebarLogoSizeInput = () => {
        if (sidebarLogoSizeInput.trim() === '') {
            setSidebarLogoSize(form.data.sidebar_logo_size);

            return;
        }

        setSidebarLogoSize(
            clampSidebarLogoSize(
                Number(sidebarLogoSizeInput),
                form.data.sidebar_logo_size,
            ),
        );
    };

    return (
        <section className="space-y-6" aria-labelledby="system-branding-title">
            <div>
                <h2 id="system-branding-title" className="text-lg font-medium">
                    System Branding
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Customize the identity shown throughout the application.
                </p>
            </div>

            <form className="space-y-6" onSubmit={submit}>
                <Card>
                    <CardHeader>
                        <CardTitle>System logo</CardTitle>
                        <CardDescription>
                            Upload a PNG, JPG, JPEG, SVG, or WebP image up to 2
                            MB.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Label
                            htmlFor="branding-logo"
                            className={cn(
                                'flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                                isDragging
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/60 hover:bg-muted/40',
                                form.processing &&
                                    'pointer-events-none opacity-60',
                            )}
                            onDragEnter={(event) => {
                                event.preventDefault();
                                setIsDragging(true);
                            }}
                            onDragOver={(event) => event.preventDefault()}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                        >
                            {previewBranding.usesCustomLogo &&
                            previewBranding.logoUrl ? (
                                <img
                                    src={previewBranding.logoUrl}
                                    alt="Selected logo preview"
                                    className="h-20 w-full max-w-56 object-contain"
                                />
                            ) : (
                                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                                    <UploadCloud className="size-6 text-muted-foreground" />
                                </div>
                            )}
                            <div className="space-y-1">
                                <p className="text-sm font-medium">
                                    {form.data.logo
                                        ? form.data.logo.name
                                        : branding.usesCustomLogo &&
                                            !form.data.remove_logo
                                          ? 'Replace the current logo'
                                          : 'Choose or drop a logo'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Click to browse or drag an image here
                                </p>
                            </div>
                        </Label>
                        <Input
                            ref={fileInput}
                            id="branding-logo"
                            type="file"
                            accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp"
                            className="sr-only"
                            disabled={form.processing}
                            onChange={handleFileInput}
                            aria-describedby="branding-logo-error"
                        />
                        <InputError
                            id="branding-logo-error"
                            message={form.errors.logo}
                        />
                        {(previewBranding.usesCustomLogo || form.data.logo) && (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={form.processing}
                                    onClick={editCurrentLogo}
                                >
                                    <Crop />
                                    Crop, resize, or rotate
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={form.processing}
                                    onClick={removeLogo}
                                >
                                    <Trash2 />
                                    Use default logo
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Brand logo size</CardTitle>
                        <CardDescription>
                            Use one display size for the expanded sidebar and
                            login screen.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <Label htmlFor="sidebar-logo-size-input">
                                Display size
                            </Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="sidebar-logo-size-input"
                                    type="number"
                                    inputMode="numeric"
                                    min={minimumSidebarLogoSize}
                                    max={maximumSidebarLogoSize}
                                    step="1"
                                    value={sidebarLogoSizeInput}
                                    disabled={form.processing}
                                    className="h-9 w-24 text-right font-medium tabular-nums"
                                    aria-invalid={Boolean(
                                        sidebarLogoSizeError ||
                                        form.errors.sidebar_logo_size,
                                    )}
                                    aria-describedby="sidebar-logo-size-help sidebar-logo-size-error"
                                    onChange={(event) =>
                                        changeSidebarLogoSizeInput(
                                            event.target.value,
                                        )
                                    }
                                    onBlur={commitSidebarLogoSizeInput}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            event.currentTarget.blur();
                                        }
                                    }}
                                />
                                <span className="text-sm text-muted-foreground">
                                    px
                                </span>
                            </div>
                        </div>
                        <Input
                            id="sidebar-logo-size-slider"
                            type="range"
                            min={minimumSidebarLogoSize}
                            max={maximumSidebarLogoSize}
                            step="1"
                            value={form.data.sidebar_logo_size}
                            disabled={form.processing}
                            className="h-8 cursor-pointer px-0 shadow-none"
                            aria-label="Brand logo size slider"
                            aria-describedby="sidebar-logo-size-help sidebar-logo-size-error"
                            onChange={(event) =>
                                setSidebarLogoSize(Number(event.target.value))
                            }
                        />
                        <div
                            id="sidebar-logo-size-help"
                            className="flex justify-between text-xs text-muted-foreground"
                        >
                            <span>{minimumSidebarLogoSize} px</span>
                            <span>Default: {defaultSidebarLogoSize} px</span>
                            <span>Maximum: {maximumSidebarLogoSize} px</span>
                        </div>
                        <InputError
                            id="sidebar-logo-size-error"
                            message={
                                sidebarLogoSizeError ??
                                form.errors.sidebar_logo_size
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            The logo stops at each container’s usable edge. In
                            the collapsed sidebar, it automatically returns to{' '}
                            {defaultSidebarLogoSize} px.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>System name</CardTitle>
                        <CardDescription>
                            This title appears with the logo in shared branding
                            areas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="system-name">System name</Label>
                            <Input
                                id="system-name"
                                value={form.data.system_name}
                                maxLength={100}
                                disabled={form.processing}
                                aria-invalid={Boolean(form.errors.system_name)}
                                aria-describedby="system-name-error"
                                onChange={(event) =>
                                    form.setData(
                                        'system_name',
                                        event.target.value,
                                    )
                                }
                            />
                            <InputError
                                id="system-name-error"
                                message={form.errors.system_name}
                            />
                        </div>

                        <fieldset className="space-y-3 border-t pt-5">
                            <legend className="text-sm font-medium">
                                Text alignment
                            </legend>
                            <div className="grid grid-cols-3 gap-2">
                                {alignmentOptions.map((option) => {
                                    const selected =
                                        form.data.title_alignment ===
                                        option.value;
                                    const Icon = option.icon;

                                    return (
                                        <Label
                                            key={option.value}
                                            className="cursor-pointer"
                                        >
                                            <input
                                                type="radio"
                                                name="title-alignment"
                                                value={option.value}
                                                checked={selected}
                                                disabled={form.processing}
                                                className="peer sr-only"
                                                onChange={() =>
                                                    form.setData(
                                                        'title_alignment',
                                                        option.value,
                                                    )
                                                }
                                            />
                                            <span
                                                className={cn(
                                                    'flex min-h-20 flex-col items-center justify-center gap-2 rounded-md border px-2 py-3 text-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                                                    selected
                                                        ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary'
                                                        : 'hover:border-primary/50 hover:bg-muted/40',
                                                )}
                                            >
                                                <Icon className="size-5" />
                                                {option.title}
                                            </span>
                                        </Label>
                                    );
                                })}
                            </div>
                            <InputError message={form.errors.title_alignment} />
                        </fieldset>

                        <fieldset className="space-y-3 border-t pt-5">
                            <legend className="text-sm font-medium">
                                Long title behavior
                            </legend>
                            <div className="grid gap-2 sm:grid-cols-3">
                                {overflowOptions.map((option) => {
                                    const selected =
                                        form.data.title_overflow ===
                                        option.value;
                                    const Icon = option.icon;

                                    return (
                                        <Label
                                            key={option.value}
                                            className="cursor-pointer"
                                        >
                                            <input
                                                type="radio"
                                                name="title-overflow"
                                                value={option.value}
                                                checked={selected}
                                                disabled={form.processing}
                                                className="peer sr-only"
                                                onChange={() =>
                                                    form.setData(
                                                        'title_overflow',
                                                        option.value,
                                                    )
                                                }
                                            />
                                            <span
                                                className={cn(
                                                    'flex h-full min-h-28 flex-col gap-2 rounded-md border p-3 text-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                                                    selected
                                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                        : 'hover:border-primary/50 hover:bg-muted/40',
                                                )}
                                            >
                                                <span className="flex items-center gap-2 font-medium">
                                                    <Icon className="size-4" />
                                                    {option.title}
                                                </span>
                                                <span className="text-xs leading-relaxed text-muted-foreground">
                                                    {option.description}
                                                </span>
                                            </span>
                                        </Label>
                                    );
                                })}
                            </div>
                            <InputError message={form.errors.title_overflow} />
                        </fieldset>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Logo and title layout</CardTitle>
                        <CardDescription>
                            Choose how the system identity is arranged.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            role="radiogroup"
                            aria-label="Branding layout"
                            className="grid gap-3 sm:grid-cols-2"
                        >
                            {layoutOptions.map((option) => {
                                const selected =
                                    form.data.layout === option.value;
                                const optionBranding: Branding = {
                                    ...previewBranding,
                                    systemName: 'System Title',
                                    layout: option.value,
                                };

                                return (
                                    <Label
                                        key={option.value}
                                        className="cursor-pointer"
                                    >
                                        <input
                                            type="radio"
                                            name="branding-layout"
                                            value={option.value}
                                            checked={selected}
                                            disabled={form.processing}
                                            className="peer sr-only"
                                            onChange={() =>
                                                form.setData(
                                                    'layout',
                                                    option.value,
                                                )
                                            }
                                        />
                                        <Card
                                            className={cn(
                                                'h-full gap-4 py-4 transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                                                selected
                                                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                                                    : 'hover:border-primary/50 hover:bg-muted/30',
                                            )}
                                        >
                                            <CardContent className="flex min-h-20 items-center justify-center px-4">
                                                <AppLogo
                                                    branding={optionBranding}
                                                    preview
                                                />
                                            </CardContent>
                                            <CardHeader className="gap-1 px-4">
                                                <div className="flex items-center justify-between gap-2">
                                                    <CardTitle className="text-sm">
                                                        {option.title}
                                                    </CardTitle>
                                                    {selected && (
                                                        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                                            <Check className="size-3" />
                                                            <span className="sr-only">
                                                                Selected
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>
                                                <CardDescription className="text-xs">
                                                    {option.description}
                                                </CardDescription>
                                            </CardHeader>
                                        </Card>
                                    </Label>
                                );
                            })}
                        </div>
                        <InputError
                            className="mt-2"
                            message={form.errors.layout}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Live preview</CardTitle>
                        <CardDescription>
                            This preview uses your current light or dark theme.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex min-h-64 items-center justify-center rounded-lg border bg-muted/30 p-4 shadow-inner">
                            <div className="w-full max-w-64 rounded-lg border border-sidebar-border bg-sidebar p-2 text-sidebar-foreground shadow-sm">
                                <div className="overflow-hidden rounded-md p-2">
                                    <AppLogo
                                        branding={previewBranding}
                                        sidebar
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {form.progress && (
                    <div
                        className="space-y-2"
                        role="progressbar"
                        aria-label="Logo upload progress"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={form.progress.percentage}
                    >
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full bg-primary transition-[width]"
                                style={{
                                    width: `${form.progress.percentage}%`,
                                }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Uploading… {form.progress.percentage}%
                        </p>
                    </div>
                )}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <AlertDialog
                        open={resetDialogOpen}
                        onOpenChange={setResetDialogOpen}
                    >
                        <AlertDialogTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={
                                    form.processing || resetForm.processing
                                }
                            >
                                <RefreshCcw />
                                Reset to Default
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    Reset system branding?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    This removes the custom logo and restores “
                                    {branding.defaultSystemName}” with the
                                    horizontal, left-aligned layout and a{' '}
                                    {defaultSidebarLogoSize} px brand logo.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel
                                    disabled={resetForm.processing}
                                />
                                <AlertDialogAction
                                    type="button"
                                    variant="destructive"
                                    disabled={resetForm.processing}
                                    onClick={() =>
                                        resetForm.delete(reset.url(), {
                                            preserveScroll: true,
                                            onSuccess: () =>
                                                setResetDialogOpen(false),
                                        })
                                    }
                                >
                                    {resetForm.processing ? (
                                        <Spinner />
                                    ) : (
                                        <RefreshCcw />
                                    )}
                                    Reset branding
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <Button
                        type="submit"
                        disabled={
                            !form.isDirty ||
                            form.processing ||
                            resetForm.processing
                        }
                    >
                        {form.processing ? <Spinner /> : <Save />}
                        {form.processing ? 'Saving…' : 'Save Changes'}
                    </Button>
                </div>
            </form>

            <LogoImageEditor
                key={editorSource?.url ?? 'empty-logo-editor'}
                open={editorOpen}
                sourceUrl={editorSource?.url ?? null}
                sourceName={editorSource?.name ?? 'system-logo.png'}
                onOpenChange={changeEditorOpen}
                onApply={applyEditedLogo}
            />
        </section>
    );
}
