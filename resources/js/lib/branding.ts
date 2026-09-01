import {
    defaultSidebarLogoSize,
    maximumSidebarLogoSize,
    minimumSidebarLogoSize,
} from '@/types';

export type BrandingLogoSizeMode = 'default' | 'preview' | 'configured';

export function clampSidebarLogoSize(
    value: number,
    fallback = defaultSidebarLogoSize,
): number {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return Math.min(
        maximumSidebarLogoSize,
        Math.max(minimumSidebarLogoSize, Math.round(value)),
    );
}

export function parseSidebarLogoSizeInput(value: string): number | null {
    if (value.trim() === '') {
        return null;
    }

    const parsedValue = Number(value);

    if (
        !Number.isInteger(parsedValue) ||
        parsedValue < minimumSidebarLogoSize ||
        parsedValue > maximumSidebarLogoSize
    ) {
        return null;
    }

    return parsedValue;
}

export function resolveBrandingLogoSize(
    value: number,
    mode: BrandingLogoSizeMode,
): number {
    if (mode === 'configured') {
        return clampSidebarLogoSize(value);
    }

    return mode === 'preview' ? 40 : defaultSidebarLogoSize;
}
