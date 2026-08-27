<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DeclineRegistrationRequest;
use App\Http\Requests\Admin\UpdateRegistrationSettingRequest;
use App\Models\AuditLog;
use App\Models\RegistrationSetting;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\RegistrationExpirationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class RegistrationVerificationController extends Controller
{
    public function __construct(private AuditLogger $auditLogger) {}

    public function index(Request $request): Response
    {
        $view = in_array($request->string('view')->toString(), ['pending', 'declined', 'expired'], true)
            ? $request->string('view')->toString()
            : 'pending';
        $search = $request->string('search')->trim()->toString();

        $registrations = $view === 'expired'
            ? $this->expiredRegistrations($search)
            : User::query()
                ->where('registration_source', User::RegistrationSourceSelf)
                ->where('status', $view === 'pending' ? User::StatusPending : User::StatusDeclined)
                ->when($search !== '', function (Builder $query) use ($search): void {
                    $query->where(function (Builder $query) use ($search): void {
                        $query->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('username', 'like', "%{$search}%");
                    });
                })
                ->latest('created_at')
                ->paginate(15)
                ->withQueryString()
                ->through(fn (User $user): array => $this->registrationData($user));

        $settings = RegistrationSetting::current();

        return Inertia::render('admin/registrations/index', [
            'registrations' => $registrations,
            'filters' => ['view' => $view, 'search' => $search],
            'settings' => [
                'pending_expiration_days' => $settings->pending_expiration_days,
                'can_manage' => $request->user()?->hasPermissionTo('settings.manage-registration') ?? false,
            ],
            'counts' => [
                'pending' => User::query()->where('registration_source', User::RegistrationSourceSelf)->where('status', User::StatusPending)->count(),
                'approaching_expiration' => User::query()
                    ->where('registration_source', User::RegistrationSourceSelf)
                    ->where('status', User::StatusPending)
                    ->whereBetween('verification_expires_at', [now(), now()->addDay()])
                    ->count(),
                'declined' => User::query()->where('registration_source', User::RegistrationSourceSelf)->where('status', User::StatusDeclined)->count(),
                'expired' => AuditLog::query()->where('event', 'registration.expired_deleted')->count(),
            ],
        ]);
    }

    public function approve(
        Request $request,
        User $user,
        RegistrationExpirationService $expirationService,
    ): RedirectResponse {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $defaultRole = Role::query()->where('is_default', true)->where('is_active', true)->first();

        if (! $defaultRole instanceof Role) {
            return back()->withErrors(['registration' => 'Configure an active default role before approving registrations.']);
        }

        $result = DB::transaction(function () use ($actor, $defaultRole, $user): string {
            $pendingUser = User::query()->lockForUpdate()->findOrFail($user->id);

            if (! $pendingUser->isPendingVerification()) {
                return 'invalid';
            }

            if ($pendingUser->hasPendingVerificationExpired()) {
                return 'expired';
            }

            $before = $this->lifecycleValues($pendingUser);
            $pendingUser->forceFill([
                'status' => User::StatusActive,
                'approved_at' => now(),
                'approved_by' => $actor->id,
                'declined_at' => null,
                'declined_by' => null,
                'decline_reason' => null,
            ])->save();
            $pendingUser->roles()->syncWithoutDetaching([
                $defaultRole->id => ['assigned_by' => $actor->id],
            ]);

            $this->auditLogger->record(
                $actor,
                'registration.approved',
                $pendingUser,
                $before,
                $this->lifecycleValues($pendingUser),
                ['assigned_default_role' => $defaultRole->name],
            );

            return 'approved';
        });

        if ($result === 'expired') {
            $expirationService->expire($user);

            return back()->withErrors(['registration' => 'This registration expired and was removed before it could be approved.']);
        }

        if ($result === 'invalid') {
            return back()->withErrors(['registration' => 'Only pending registrations can be approved.']);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Registration approved. The user can now sign in.']);

        return back();
    }

    public function decline(
        DeclineRegistrationRequest $request,
        User $user,
        RegistrationExpirationService $expirationService,
    ): RedirectResponse {
        if ($user->hasPendingVerificationExpired()) {
            $expirationService->expire($user);

            return back()->withErrors(['registration' => 'This registration had already expired and was removed.']);
        }

        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $result = DB::transaction(function () use ($actor, $request, $user): string {
            $pendingUser = User::query()->lockForUpdate()->findOrFail($user->id);

            if (! $pendingUser->isPendingVerification()) {
                return 'invalid';
            }

            if ($pendingUser->hasPendingVerificationExpired()) {
                return 'expired';
            }

            $before = $this->lifecycleValues($pendingUser);
            $pendingUser->forceFill([
                'status' => User::StatusDeclined,
                'declined_at' => now(),
                'declined_by' => $actor->id,
                'decline_reason' => $request->validated('reason') ?: 'Declined by an administrator.',
            ])->save();
            $pendingUser->roles()->detach();
            DB::table('sessions')->where('user_id', $pendingUser->id)->delete();

            $this->auditLogger->record(
                $actor,
                'registration.declined',
                $pendingUser,
                $before,
                $this->lifecycleValues($pendingUser),
            );

            return 'declined';
        });

        if ($result === 'expired') {
            $expirationService->expire($user);

            return back()->withErrors(['registration' => 'This registration had already expired and was removed.']);
        }

        if ($result === 'invalid') {
            return back()->withErrors(['registration' => 'Only pending registrations can be declined.']);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Registration declined.']);

        return back();
    }

    public function updateSetting(UpdateRegistrationSettingRequest $request): RedirectResponse
    {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        DB::transaction(function () use ($actor, $request): void {
            $setting = RegistrationSetting::query()->lockForUpdate()->findOrFail(1);
            $before = ['pending_expiration_days' => $setting->pending_expiration_days];
            $setting->update([
                'pending_expiration_days' => $request->integer('pending_expiration_days'),
                'updated_by' => $actor->id,
            ]);

            $this->auditLogger->record(
                $actor,
                'registration.settings_updated',
                $setting,
                $before,
                ['pending_expiration_days' => $setting->pending_expiration_days],
            );
        });
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Registration expiration setting updated.']);

        return back();
    }

    /** @return LengthAwarePaginator<int, AuditLog> */
    private function expiredRegistrations(string $search): LengthAwarePaginator
    {
        return AuditLog::query()
            ->select(['id', 'subject_id', 'metadata', 'created_at'])
            ->where('event', 'registration.expired_deleted')
            ->when($search !== '', fn (Builder $query) => $query->where('metadata', 'like', "%{$search}%"))
            ->latest('created_at')
            ->paginate(15)
            ->withQueryString();
    }

    /** @return array<string, mixed> */
    private function registrationData(User $user): array
    {
        $expiresAt = $user->verification_expires_at;
        $remainingSeconds = $expiresAt === null
            ? null
            : max(0, $expiresAt->getTimestamp() - now()->getTimestamp());

        return [
            'id' => $user->id,
            'user_id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'status' => $user->status,
            'registered_at' => $user->created_at?->toISOString(),
            'verification_expires_at' => $expiresAt?->toISOString(),
            'resolved_at' => $user->declined_at?->toISOString() ?? $user->approved_at?->toISOString(),
            'decline_reason' => $user->decline_reason,
            'remaining_seconds' => $remainingSeconds,
            'is_approaching_expiration' => $user->isPendingVerification()
                && $remainingSeconds !== null
                && $remainingSeconds <= 86400,
            'can_review' => $user->isPendingVerification(),
        ];
    }

    /** @return array<string, mixed> */
    private function lifecycleValues(User $user): array
    {
        return [
            'status' => $user->status,
            'registration_source' => $user->registration_source,
            'verification_expires_at' => $user->verification_expires_at?->toISOString(),
            'approved_at' => $user->approved_at?->toISOString(),
            'approved_by' => $user->approved_by,
            'declined_at' => $user->declined_at?->toISOString(),
            'declined_by' => $user->declined_by,
            'decline_reason' => $user->decline_reason,
        ];
    }
}
