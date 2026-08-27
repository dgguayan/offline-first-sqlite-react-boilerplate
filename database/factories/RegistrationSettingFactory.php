<?php

namespace Database\Factories;

use App\Models\RegistrationSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RegistrationSetting>
 */
class RegistrationSettingFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'pending_expiration_days' => RegistrationSetting::DefaultPendingExpirationDays,
            'updated_by' => null,
        ];
    }
}
