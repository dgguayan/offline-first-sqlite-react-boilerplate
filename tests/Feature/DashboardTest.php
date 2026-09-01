<?php

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Inertia\Testing\AssertableInertia as Assert;

test('guests are redirected to the login page', function () {
    $this->get(route('dashboard'))->assertRedirect(route('login'));
    $this->get(route('tasks'))->assertRedirect(route('login'));
});

test('dashboard and offline-first tasks are independent pages', function () {
    $this->seed(RbacSeeder::class);
    $user = User::factory()->create();
    $defaultRole = Role::query()->where('is_default', true)->firstOrFail();
    $user->roles()->attach($defaultRole, ['assigned_by' => $user->id]);
    $this->actingAs($user);

    $this->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('dashboard'));

    $this->get(route('tasks'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('tasks'));
});

test('offline-first tasks require their dedicated permission', function () {
    $this->seed(RbacSeeder::class);
    $user = User::factory()->create();
    $dashboardRole = Role::factory()->create();
    $dashboardPermission = Permission::query()
        ->where('slug', 'dashboard.view')
        ->firstOrFail();

    $dashboardRole->permissions()->attach($dashboardPermission, [
        'scope' => 'all',
    ]);
    $user->roles()->attach($dashboardRole, ['assigned_by' => $user->id]);

    $this->actingAs($user)->get(route('dashboard'))->assertOk();
    $this->actingAs($user)->get(route('tasks'))->assertForbidden();
});
