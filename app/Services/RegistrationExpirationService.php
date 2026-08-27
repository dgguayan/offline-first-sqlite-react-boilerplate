<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Throwable;

class RegistrationExpirationService
{
    public function __construct(private AuditLogger $auditLogger) {}

    /** @return array{expired: int, failed: int} */
    public function expireDueRegistrations(): array
    {
        $expired = 0;
        $failed = 0;

        User::query()
            ->where('status', User::StatusPending)
            ->whereNotNull('verification_expires_at')
            ->where('verification_expires_at', '<=', now())
            ->select('id')
            ->chunkById(100, function ($users) use (&$expired, &$failed): void {
                foreach ($users as $user) {
                    try {
                        if ($this->expire($user)) {
                            $expired++;
                        }
                    } catch (Throwable $exception) {
                        report($exception);
                        $failed++;
                    }
                }
            });

        return ['expired' => $expired, 'failed' => $failed];
    }

    public function expire(User $user): bool
    {
        return DB::transaction(function () use ($user): bool {
            $pendingUser = User::query()->lockForUpdate()->find($user->id);

            if (! $pendingUser instanceof User || ! $pendingUser->hasPendingVerificationExpired()) {
                return false;
            }

            $expiredAt = now();
            $identity = [
                'user_id' => $pendingUser->id,
                'name' => $pendingUser->name,
                'email' => $pendingUser->email,
                'registered_at' => $pendingUser->created_at?->toISOString(),
                'verification_expires_at' => $pendingUser->verification_expires_at?->toISOString(),
                'expired_at' => $expiredAt->toISOString(),
            ];

            $pendingUser->forceFill([
                'status' => User::StatusDeclined,
                'declined_at' => $expiredAt,
                'declined_by' => null,
                'decline_reason' => 'Automatically declined because the verification period expired.',
            ])->save();

            $this->auditLogger->record(
                null,
                'registration.auto_declined',
                $pendingUser,
                ['status' => User::StatusPending],
                [
                    'status' => User::StatusDeclined,
                    'declined_at' => $expiredAt->toISOString(),
                    'reason' => $pendingUser->decline_reason,
                ],
                $identity,
            );

            DB::table('sessions')->where('user_id', $pendingUser->id)->delete();

            $this->auditLogger->record(
                null,
                'registration.expired_deleted',
                $pendingUser,
                ['status' => User::StatusDeclined],
                ['status' => 'expired_deleted', 'deleted_at' => $expiredAt->toISOString()],
                $identity,
            );

            $pendingUser->delete();

            return true;
        });
    }
}
