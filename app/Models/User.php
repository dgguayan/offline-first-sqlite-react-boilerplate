<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property int $id
 * @property string $name
 * @property string|null $username
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string $status
 * @property string $registration_source
 * @property string|null $job_title
 * @property string|null $department
 * @property string|null $phone
 * @property string|null $bio
 * @property Carbon|null $last_login_at
 * @property Carbon|null $deactivated_at
 * @property Carbon|null $verification_expires_at
 * @property Carbon|null $approved_at
 * @property int|null $approved_by
 * @property Carbon|null $declined_at
 * @property int|null $declined_by
 * @property string|null $decline_reason
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'username', 'email', 'password', 'status', 'registration_source', 'job_title', 'department', 'phone', 'bio', 'last_login_at', 'deactivated_at', 'verification_expires_at', 'approved_at', 'approved_by', 'declined_at', 'declined_by', 'decline_reason'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    public const StatusActive = 'active';

    public const StatusInactive = 'inactive';

    public const StatusPending = 'pending';

    public const StatusDeclined = 'declined';

    public const RegistrationSourceAdmin = 'admin';

    public const RegistrationSourceSelf = 'self';

    /** @var array<string, string>|null */
    private ?array $resolvedPermissionScopes = null;

    /** @return BelongsToMany<Role, $this> */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class)
            ->withPivot(['assigned_by', 'expires_at'])
            ->withCasts(['expires_at' => 'datetime'])
            ->withTimestamps();
    }

    /** @return HasMany<AuditLog, $this> */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'actor_id');
    }

    /**
     * Return the strongest scope granted for every permission on active, unexpired roles.
     *
     * @return array<string, string>
     */
    public function permissionScopes(): array
    {
        if ($this->resolvedPermissionScopes !== null) {
            return $this->resolvedPermissionScopes;
        }

        $scopeRanks = ['own' => 1, 'department' => 2, 'all' => 3];
        $permissions = [];
        $roles = $this->roles()
            ->where('roles.is_active', true)
            ->where(function ($query): void {
                $query->whereNull('role_user.expires_at')
                    ->orWhere('role_user.expires_at', '>', now());
            })
            ->with('permissions')
            ->get();

        foreach ($roles as $role) {
            foreach ($role->permissions as $permission) {
                $scope = $permission->assignedScope();
                $currentScope = $permissions[$permission->slug] ?? null;

                if ($currentScope === null || ($scopeRanks[$scope] ?? 0) > ($scopeRanks[$currentScope] ?? 0)) {
                    $permissions[$permission->slug] = $scope;
                }
            }
        }

        return $this->resolvedPermissionScopes = $permissions;
    }

    public function hasPermissionTo(string $permission): bool
    {
        return array_key_exists($permission, $this->permissionScopes());
    }

    public function permissionScope(string $permission): ?string
    {
        return $this->permissionScopes()[$permission] ?? null;
    }

    public function clearPermissionCache(): void
    {
        $this->resolvedPermissionScopes = null;
        $this->unsetRelation('roles');
    }

    public function isActive(): bool
    {
        return $this->status === self::StatusActive;
    }

    public function isPendingVerification(): bool
    {
        return $this->status === self::StatusPending;
    }

    public function hasPendingVerificationExpired(): bool
    {
        return $this->isPendingVerification()
            && $this->verification_expires_at !== null
            && $this->verification_expires_at->isPast();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'last_login_at' => 'datetime',
            'deactivated_at' => 'datetime',
            'verification_expires_at' => 'datetime',
            'approved_at' => 'datetime',
            'declined_at' => 'datetime',
        ];
    }
}
