<?php

namespace Database\Seeders;

use App\Models\BrandingSetting;
use Illuminate\Database\Seeder;

class BrandingSettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        BrandingSetting::query()->firstOrCreate(
            ['id' => 1],
            [
                'system_name' => (string) config('app.name', 'Laravel'),
                'logo_path' => null,
                'layout' => BrandingSetting::Horizontal,
                'title_alignment' => BrandingSetting::AlignLeft,
                'title_overflow' => BrandingSetting::OverflowEllipsis,
                'sidebar_logo_size' => BrandingSetting::DefaultSidebarLogoSize,
                'use_custom_logo' => false,
                'updated_by' => null,
            ],
        );
    }
}
