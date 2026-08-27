<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\BrandingService;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $branding = app(BrandingService::class)->shared();

        return [
            ...parent::share($request),
            'name' => $branding['systemName'],
            'branding' => $branding,
            'auth' => [
                'user' => $request->user(),
                'permissions' => fn (): array => $request->user()?->permissionScopes() ?? [],
                'roles' => fn (): array => $request->user()?->roles()
                    ->where('roles.is_active', true)
                    ->pluck('roles.name')
                    ->all() ?? [],
                'pending_registration_count' => fn (): int => $request->user()?->hasPermissionTo('users.verify-registrations')
                    ? User::query()
                        ->where('registration_source', User::RegistrationSourceSelf)
                        ->where('status', User::StatusPending)
                        ->count()
                    : 0,
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
