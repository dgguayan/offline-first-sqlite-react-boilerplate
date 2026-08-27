<?php

namespace Database\Factories;

use App\Models\RegistrationSetting;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'username' => fake()->unique()->userName(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'status' => User::StatusActive,
            'registration_source' => User::RegistrationSourceAdmin,
            'job_title' => fake()->jobTitle(),
            'department' => fake()->randomElement(['Operations', 'Finance', 'Technology']),
            'phone' => fake()->phoneNumber(),
            'bio' => fake()->optional()->sentence(),
            'last_login_at' => null,
            'deactivated_at' => null,
            'verification_expires_at' => null,
            'approved_at' => now(),
            'approved_by' => null,
            'declined_at' => null,
            'declined_by' => null,
            'decline_reason' => null,
            'remember_token' => Str::random(10),
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    public function pendingVerification(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => User::StatusPending,
            'registration_source' => User::RegistrationSourceSelf,
            'verification_expires_at' => now()->addDays(RegistrationSetting::DefaultPendingExpirationDays),
            'approved_at' => null,
            'approved_by' => null,
            'declined_at' => null,
            'declined_by' => null,
            'decline_reason' => null,
        ]);
    }

    /**
     * Indicate that the model has two-factor authentication configured.
     */
    public function withTwoFactor(): static
    {
        return $this->state(fn (array $attributes) => [
            'two_factor_secret' => encrypt('secret'),
            'two_factor_recovery_codes' => encrypt(json_encode(['recovery-code-1'])),
            'two_factor_confirmed_at' => now(),
        ]);
    }
}
