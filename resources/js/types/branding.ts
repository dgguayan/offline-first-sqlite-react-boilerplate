export type BrandingLayout =
    'horizontal' | 'vertical' | 'logo-only' | 'title-only';

export type BrandingTitleAlignment = 'left' | 'center' | 'right';

export type BrandingTitleOverflow = 'ellipsis' | 'clip' | 'wrap';

export const minimumSidebarLogoSize = 24;
export const defaultSidebarLogoSize = 32;
export const maximumSidebarLogoSize = 216;

export type Branding = {
    systemName: string;
    logoUrl: string | null;
    layout: BrandingLayout;
    titleAlignment: BrandingTitleAlignment;
    titleOverflow: BrandingTitleOverflow;
    sidebarLogoSize: number;
    usesCustomLogo: boolean;
    isDefault: boolean;
    defaultSystemName: string;
    updatedAt: string | null;
};
