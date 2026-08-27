<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('users.view');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, User $model): bool
    {
        return $this->scopeAllows($user, $model, 'users.view');
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->hasPermissionTo('users.create');
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, User $model): bool
    {
        return $this->scopeAllows($user, $model, 'users.edit');
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, User $model): bool
    {
        return $user->isNot($model) && $this->scopeAllows($user, $model, 'users.delete');
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, User $model): bool
    {
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, User $model): bool
    {
        return false;
    }

    public function deactivate(User $user, User $model): bool
    {
        return $user->isNot($model) && $this->scopeAllows($user, $model, 'users.deactivate');
    }

    public function resetPassword(User $user, User $model): bool
    {
        return $user->isNot($model) && $this->scopeAllows($user, $model, 'users.reset-password');
    }

    public function assignRoles(User $user, User $model): bool
    {
        return $user->isNot($model) && $this->scopeAllows($user, $model, 'users.assign-roles');
    }

    private function scopeAllows(User $actor, User $subject, string $permission): bool
    {
        return match ($actor->permissionScope($permission)) {
            'all' => true,
            'department' => filled($actor->department) && $actor->department === $subject->department,
            'own' => $actor->is($subject),
            default => false,
        };
    }
}
