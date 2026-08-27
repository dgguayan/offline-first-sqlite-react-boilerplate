<?php

namespace App\Services;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class RolePermissionService
{
    public function __construct(private AuditLogger $auditLogger) {}

    /**
     * @param  list<array{permission_id: int, scope: string}>  $grants
     */
    public function sync(Role $role, array $grants, User $actor): void
    {
        $permissions = Permission::query()
            ->whereIn('id', collect($grants)->pluck('permission_id'))
            ->get()
            ->keyBy('id');

        if (! $actor->hasPermissionTo('roles.grant-any')) {
            if ($role->users()->whereKey($actor->id)->exists()) {
                throw new AuthorizationException('You cannot change permissions inherited by your own account.');
            }

            foreach ($grants as $grant) {
                $permission = $permissions->get($grant['permission_id']);

                if ($permission === null || ! $this->scopeIsWithin($grant['scope'], $actor->permissionScope($permission->slug))) {
                    throw new AuthorizationException('You cannot grant a permission or data scope that you do not have.');
                }
            }
        }

        foreach ($grants as $grant) {
            $permission = $permissions->get($grant['permission_id']);

            if ($permission === null || ! in_array($grant['scope'], $permission->allowed_scopes, true)) {
                throw new AuthorizationException('The selected data scope is not allowed for this permission.');
            }
        }

        DB::transaction(function () use ($role, $grants, $permissions, $actor): void {
            $oldValues = $role->permissions()
                ->get()
                ->mapWithKeys(fn (Permission $permission): array => [$permission->slug => $permission->assignedScope()])
                ->all();

            $syncData = collect($grants)->mapWithKeys(fn (array $grant): array => [
                $grant['permission_id'] => ['scope' => $grant['scope']],
            ]);
            $role->permissions()->sync($syncData);

            $newValues = collect($grants)->mapWithKeys(function (array $grant) use ($permissions): array {
                $permission = $permissions->get($grant['permission_id']);

                return [$permission->slug => $grant['scope']];
            })->all();

            $this->auditLogger->record($actor, 'role.permissions_updated', $role, $oldValues, $newValues);
        });
    }

    private function scopeIsWithin(string $requestedScope, ?string $actorScope): bool
    {
        $scopeRanks = ['own' => 1, 'department' => 2, 'all' => 3];

        return ($scopeRanks[$requestedScope] ?? 0) <= ($scopeRanks[$actorScope] ?? 0);
    }
}
