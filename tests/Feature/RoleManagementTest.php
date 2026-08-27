<?php

use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RbacSeeder;

beforeEach(function () {
    $this->administrator = User::factory()->create();
    $this->seed(RbacSeeder::class);
});

test('administrator can create a dynamic role with scoped permissions', function () {
    $permission = Permission::query()->where('slug', 'users.view')->firstOrFail();

    $response = $this->actingAs($this->administrator)->post(route('admin.roles.store'), [
        'name' => 'Finance Reviewer',
        'slug' => 'finance-reviewer',
        'description' => 'Reviews finance users.',
        'is_active' => true,
        'is_default' => false,
        'permissions' => [['permission_id' => $permission->id, 'scope' => 'department']],
    ]);

    $role = Role::query()->where('slug', 'finance-reviewer')->firstOrFail();
    $response->assertSessionHasNoErrors()->assertRedirect(route('admin.roles.edit', $role));
    expect($role->permissions()->firstOrFail()->pivot->scope)->toBe('department');
    expect(AuditLog::query()->where('event', 'role.permissions_updated')->where('subject_id', $role->id)->exists())->toBeTrue();
});

test('limited role managers cannot grant permissions they do not possess', function () {
    $manager = User::factory()->create();
    $managerRole = Role::factory()->create();
    foreach (['roles.create', 'roles.manage-permissions'] as $slug) {
        $managerRole->permissions()->attach(Permission::query()->where('slug', $slug)->firstOrFail(), ['scope' => 'all']);
    }
    $manager->roles()->attach($managerRole);
    $grantAny = Permission::query()->where('slug', 'roles.grant-any')->firstOrFail();

    $this->actingAs($manager)->post(route('admin.roles.store'), [
        'name' => 'Escalated',
        'slug' => 'escalated',
        'description' => null,
        'is_active' => true,
        'is_default' => false,
        'permissions' => [['permission_id' => $grantAny->id, 'scope' => 'all']],
    ])->assertForbidden();

    expect(Role::query()->where('slug', 'escalated')->exists())->toBeFalse();
});

test('inactive and expired roles grant no effective permissions', function () {
    $user = User::factory()->create();
    $permission = Permission::query()->where('slug', 'users.view')->firstOrFail();
    $inactiveRole = Role::factory()->create(['is_active' => false]);
    $inactiveRole->permissions()->attach($permission, ['scope' => 'all']);
    $expiredRole = Role::factory()->create();
    $expiredRole->permissions()->attach($permission, ['scope' => 'all']);
    $user->roles()->attach($inactiveRole);
    $user->roles()->attach($expiredRole, ['expires_at' => now()->subMinute()]);

    expect($user->hasPermissionTo('users.view'))->toBeFalse();
});

test('a manager without grant-any cannot modify their inherited role', function () {
    $manager = User::factory()->create();
    $role = Role::factory()->create();
    $role->permissions()->attach(Permission::query()->where('slug', 'roles.edit')->firstOrFail(), ['scope' => 'all']);
    $manager->roles()->attach($role);

    $this->actingAs($manager)->put(route('admin.roles.update', $role), [
        'name' => 'Changed own role',
        'slug' => $role->slug,
        'description' => null,
        'is_active' => true,
        'is_default' => false,
    ])->assertForbidden();
});

test('assigned and default roles cannot be deleted', function () {
    $assignedRole = Role::factory()->create();
    User::factory()->create()->roles()->attach($assignedRole);

    $this->actingAs($this->administrator)->delete(route('admin.roles.destroy', $assignedRole))->assertSessionHasErrors('role');

    $defaultRole = Role::query()->where('is_default', true)->firstOrFail();
    $this->actingAs($this->administrator)->delete(route('admin.roles.destroy', $defaultRole))->assertSessionHasErrors('role');
});

test('rerunning the bootstrap seeder preserves role changes made through the ui', function () {
    $administratorRole = Role::query()->where('slug', 'administrator')->firstOrFail();
    $removedPermission = Permission::query()->where('slug', 'audit-logs.view')->firstOrFail();
    $administratorRole->update(['name' => 'Local Administrators']);
    $administratorRole->permissions()->detach($removedPermission);

    $this->seed(RbacSeeder::class);

    expect($administratorRole->refresh()->name)->toBe('Local Administrators');
    expect($administratorRole->permissions()->whereKey($removedPermission->id)->exists())->toBeFalse();
});
