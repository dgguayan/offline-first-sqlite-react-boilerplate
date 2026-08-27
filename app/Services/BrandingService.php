<?php

namespace App\Services;

use App\Models\BrandingSetting;
use Illuminate\Support\Facades\Storage;

class BrandingService
{
    public function current(): BrandingSetting
    {
        return BrandingSetting::query()->firstOrNew(
            ['id' => 1],
            $this->defaults(),
        );
    }

    /**
     * @return array{system_name: string, logo_path: null, layout: string, title_alignment: string, title_overflow: string, sidebar_logo_size: int, use_custom_logo: false, updated_by: null}
     */
    public function defaults(): array
    {
        return [
            'system_name' => (string) config('app.name', 'Laravel'),
            'logo_path' => null,
            'layout' => BrandingSetting::Horizontal,
            'title_alignment' => BrandingSetting::AlignLeft,
            'title_overflow' => BrandingSetting::OverflowEllipsis,
            'sidebar_logo_size' => BrandingSetting::DefaultSidebarLogoSize,
            'use_custom_logo' => false,
            'updated_by' => null,
        ];
    }

    /**
     * @return array{systemName: string, logoUrl: string|null, layout: string, titleAlignment: string, titleOverflow: string, sidebarLogoSize: int, usesCustomLogo: bool, isDefault: bool, defaultSystemName: string, updatedAt: string|null}
     */
    public function shared(): array
    {
        $branding = $this->current();
        $logoUrl = null;

        if ($branding->use_custom_logo && filled($branding->logo_path)) {
            $logoUrl = config('filesystems.disks.public.driver') === 'local'
                ? '/storage/'.ltrim($branding->logo_path, '/')
                : Storage::disk('public')->url($branding->logo_path);

            if ($branding->updated_at !== null) {
                $separator = str_contains($logoUrl, '?') ? '&' : '?';
                $logoUrl .= $separator.'v='.$branding->updated_at->getTimestamp();
            }
        }

        $defaults = $this->defaults();

        return [
            'systemName' => $branding->system_name,
            'logoUrl' => $logoUrl,
            'layout' => $branding->layout,
            'titleAlignment' => $branding->title_alignment,
            'titleOverflow' => $branding->title_overflow,
            'sidebarLogoSize' => $branding->sidebar_logo_size,
            'usesCustomLogo' => $branding->use_custom_logo,
            'isDefault' => $branding->system_name === $defaults['system_name']
                && $branding->logo_path === null
                && $branding->layout === $defaults['layout']
                && $branding->title_alignment === $defaults['title_alignment']
                && $branding->title_overflow === $defaults['title_overflow']
                && $branding->sidebar_logo_size === $defaults['sidebar_logo_size']
                && ! $branding->use_custom_logo,
            'defaultSystemName' => $defaults['system_name'],
            'updatedAt' => $branding->updated_at?->toISOString(),
        ];
    }

    /**
     * @return array{system_name: string, logo_path: string|null, layout: string, title_alignment: string, title_overflow: string, sidebar_logo_size: int, use_custom_logo: bool}
     */
    public function snapshot(BrandingSetting $branding): array
    {
        return [
            'system_name' => $branding->system_name,
            'logo_path' => $branding->logo_path,
            'layout' => $branding->layout,
            'title_alignment' => $branding->title_alignment,
            'title_overflow' => $branding->title_overflow,
            'sidebar_logo_size' => $branding->sidebar_logo_size,
            'use_custom_logo' => $branding->use_custom_logo,
        ];
    }
}
