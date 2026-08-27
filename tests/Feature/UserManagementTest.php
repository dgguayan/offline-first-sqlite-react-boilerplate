<?php

use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->administrator = User::factory()->create(['department' => 'Administration']);
    $this->seed(RbacSeeder::class);
});

test('user administration pages require database permissions', function () {
    $ordinaryUser = User::factory()->create();
    $ordinaryUser->roles()->attach(Role::query()->where('is_default', true)->firstOrFail());

    $this->actingAs($ordinaryUser)->get(route('admin.users.index'))->assertForbidden();

    $this->actingAs($this->administrator)
        ->get(route('admin.users.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('admin/users/index'));
});

test('administrators can create and edit a user with audited profile values', function () {
    $response = $this->actingAs($this->administrator)->post(route('admin.users.store'), [
        'name' => 'Taylor Example',
        'username' => 'taylor',
        'email' => 'taylor@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
        'status' => 'active',
        'job_title' => 'Analyst',
        'department' => 'Finance',
        'phone' => '555-0100',
        'bio' => 'Finance analyst.',
    ]);

    $user = User::query()->where('email', 'taylor@example.com')->firstOrFail();
    $response->assertSessionHasNoErrors()->assertRedirect(route('admin.users.show', $user));
    expect($user->roles()->where('is_default', true)->exists())->toBeTrue();
    expect(AuditLog::query()->where('event', 'user.created')->where('subject_id', $user->id)->exists())->toBeTrue();

    $this->actingAs($this->administrator)->put(route('admin.users.update', $user), [
        'name' => 'Taylor Updated',
        'username' => 'taylor',
        'email' => 'taylor.updated@example.com',
        'job_title' => 'Senior Analyst',
        'department' => 'Finance',
        'phone' => '555-0100',
        'bio' => 'Updated profile.',
    ])->assertSessionHasNoErrors();

    expect($user->refresh()->name)->toBe('Taylor Updated');
    expect($user->email_verified_at)->toBeNull();
    expect(AuditLog::query()->where('event', 'user.updated')->where('subject_id', $user->id)->exists())->toBeTrue();
});

test('department data scope limits the user list and resource access', function () {
    $financeViewer = User::factory()->create(['department' => 'Finance']);
    $financeUser = User::factory()->create(['department' => 'Finance']);
    $technologyUser = User::factory()->create(['department' => 'Technology']);
    $role = Role::factory()->create();
    $role->permissions()->attach(Permission::query()->where('slug', 'users.view')->firstOrFail(), ['scope' => 'department']);
    $financeViewer->roles()->attach($role);

    $this->actingAs($financeViewer)
        ->get(route('admin.users.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('users.data', 2)
            ->where('users.data.0.department', 'Finance')
            ->where('users.data.1.department', 'Finance'));

    $this->actingAs($financeViewer)->get(route('admin.users.show', $financeUser))->assertOk();
    $this->actingAs($financeViewer)->get(route('admin.users.show', $technologyUser))->assertForbidden();
});

test('administrators cannot deactivate delete or change their own role assignments', function () {
    $this->actingAs($this->administrator)->patch(route('admin.users.deactivate', $this->administrator))->assertForbidden();
    $this->actingAs($this->administrator)->delete(route('admin.users.destroy', $this->administrator))->assertForbidden();
    $this->actingAs($this->administrator)->put(route('admin.users.roles.update', $this->administrator), ['assignments' => []])->assertForbidden();

    expect($this->administrator->fresh())->not->toBeNull();
});

test('deactivation revokes sessions and creates an audit record', function () {
    $user = User::factory()->create();
    DB::table('sessions')->insert([
        'id' => 'target-session',
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Pest',
        'payload' => '',
        'last_activity' => now()->timestamp,
    ]);

    $this->actingAs($this->administrator)->patch(route('admin.users.deactivate', $user))->assertRedirect();

    expect($user->refresh()->status)->toBe('inactive');
    expect(DB::table('sessions')->where('user_id', $user->id)->exists())->toBeFalse();
    expect(AuditLog::query()->where('event', 'user.deactivated')->where('subject_id', $user->id)->exists())->toBeTrue();
});

test('role assignments support expiry and reject privilege escalation', function () {
    $target = User::factory()->create();
    $role = Role::factory()->create();
    $role->permissions()->attach(Permission::query()->where('slug', 'users.view')->firstOrFail(), ['scope' => 'all']);

    $this->actingAs($this->administrator)->put(route('admin.users.roles.update', $target), [
        'assignments' => [['role_id' => $role->id, 'expires_at' => now()->addWeek()->toDateString()]],
    ])->assertSessionHasNoErrors();

    expect($target->roles()->whereKey($role->id)->exists())->toBeTrue();
    expect(AuditLog::query()->where('event', 'user.roles_updated')->where('subject_id', $target->id)->exists())->toBeTrue();

    $limitedManager = User::factory()->create();
    $managerRole = Role::factory()->create();
    foreach (['users.assign-roles', 'users.view'] as $slug) {
        $managerRole->permissions()->attach(Permission::query()->where('slug', $slug)->firstOrFail(), ['scope' => 'all']);
    }
    $limitedManager->roles()->attach($managerRole);
    $privilegedRole = Role::factory()->create();
    $privilegedRole->permissions()->attach(Permission::query()->where('slug', 'roles.grant-any')->firstOrFail(), ['scope' => 'all']);

    $this->actingAs($limitedManager)->put(route('admin.users.roles.update', $target), [
        'assignments' => [['role_id' => $privilegedRole->id, 'expires_at' => null]],
    ])->assertForbidden();
});

test('an authorized administrator can trigger the password reset flow', function () {
    Notification::fake();
    $user = User::factory()->create();

    $this->actingAs($this->administrator)->post(route('admin.users.password-reset', $user))->assertSessionHasNoErrors();

    Notification::assertSentTo($user, ResetPassword::class);
    expect(AuditLog::query()->where('event', 'user.password_reset_requested')->where('subject_id', $user->id)->exists())->toBeTrue();
});
