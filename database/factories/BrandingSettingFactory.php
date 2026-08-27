<?php

namespace Database\Factories;

use App\Models\BrandingSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BrandingSetting>
 */
class BrandingSettingFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'system_name' => fake()->company().' Workspace',
            'logo_path' => null,
            'layout' => fake()->randomElement(BrandingSetting::Layouts),
            'title_alignment' => fake()->randomElement(BrandingSetting::TitleAlignments),
            'title_overflow' => fake()->randomElement(BrandingSetting::TitleOverflows),
            'sidebar_logo_size' => fake()->numberBetween(
                BrandingSetting::MinimumSidebarLogoSize,
                BrandingSetting::MaximumSidebarLogoSize,
            ),
            'use_custom_logo' => false,
            'updated_by' => null,
        ];
    }

    public function withCustomLogo(string $path = 'branding/logo.png'): static
    {
        return $this->state(fn (): array => [
            'logo_path' => $path,
            'use_custom_logo' => true,
        ]);
    }
}
