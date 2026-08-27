<?php

use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\PermissionModule;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->administrator = User::factory()->create();
    $this->seed(RbacSeeder::class);
});

test('permission catalog requires its database permission', function () {
    $ordinaryUser = User::factory()->create();

    $this->actingAs($ordinaryUser)->get(route('admin.permissions.index'))->assertForbidden();
    $this->actingAs($this->administrator)
        ->get(route('admin.permissions.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('admin/permissions/index')->has('modules'));
});

test('administrator can dynamically create and edit modules and permissions', function () {
    $this->actingAs($this->administrator)->post(route('admin.permission-modules.store'), [
        'name' => 'Reports',
        'slug' => 'reports',
        'description' => 'Reporting features.',
        'sort_order' => 50,
    ])->assertSessionHasNoErrors();

    $module = PermissionModule::query()->where('slug', 'reports')->firstOrFail();
    $this->actingAs($this->administrator)->post(route('admin.permissions.store'), [
        'permission_module_id' => $module->id,
        'name' => 'Export reports',
        'slug' => 'reports.export',
        'action' => 'export',
        'description' => 'Download report files.',
        'allowed_scopes' => ['all', 'department'],
    ])->assertSessionHasNoErrors();

    $permission = Permission::query()->where('slug', 'reports.export')->firstOrFail();
    $this->actingAs($this->administrator)->put(route('admin.permissions.update', $permission), [
        'permission_module_id' => $module->id,
        'name' => 'Export reporting data',
        'slug' => 'reports.export',
        'action' => 'export',
        'description' => 'Download reporting data.',
        'allowed_scopes' => ['all'],
    ])->assertSessionHasNoErrors();

    expect($permission->refresh()->name)->toBe('Export reporting data');
    expect(AuditLog::query()->where('event', 'permission.created')->where('subject_id', $permission->id)->exists())->toBeTrue();
    expect(AuditLog::query()->where('event', 'permission.updated')->where('subject_id', $permission->id)->exists())->toBeTrue();
});

test('assigned permissions and nonempty modules cannot be deleted', function () {
    $module = PermissionModule::factory()->create();
    $permission = Permission::factory()->create(['permission_module_id' => $module->id]);
    Role::factory()->create()->permissions()->attach($permission, ['scope' => 'all']);

    $this->actingAs($this->administrator)->delete(route('admin.permissions.destroy', $permission))->assertSessionHasErrors('permission');
    $this->actingAs($this->administrator)->delete(route('admin.permission-modules.destroy', $module))->assertSessionHasErrors('module');

    expect($permission->fresh())->not->toBeNull();
    expect($module->fresh())->not->toBeNull();
});
