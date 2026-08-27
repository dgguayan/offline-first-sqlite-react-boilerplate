<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Models\RegistrationSetting;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

    public function __construct(private AuditLogger $auditLogger) {}

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            ...$this->profileRules(),
            'password' => $this->passwordRules(),
        ])->validate();

        $verificationExpiresAt = now()->addDays(RegistrationSetting::current()->pending_expiration_days);

        return DB::transaction(function () use ($input, $verificationExpiresAt): User {
            $user = User::create([
                'name' => $input['name'],
                'email' => $input['email'],
                'password' => $input['password'],
                'status' => User::StatusPending,
                'registration_source' => User::RegistrationSourceSelf,
                'verification_expires_at' => $verificationExpiresAt,
            ]);

            $this->auditLogger->record(
                $user,
                'registration.submitted',
                $user,
                null,
                [
                    'status' => User::StatusPending,
                    'name' => $user->name,
                    'email' => $user->email,
                    'registered_at' => $user->created_at?->toISOString(),
                    'verification_expires_at' => $verificationExpiresAt->toISOString(),
                ],
            );

            return $user;
        });
    }
}
