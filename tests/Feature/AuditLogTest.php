<?php

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->administrator = User::factory()->create();
    $this->seed(RbacSeeder::class);
});

test('authorized users can view and filter immutable audit history', function () {
    AuditLog::factory()->create(['actor_id' => $this->administrator->id, 'event' => 'role.updated']);
    AuditLog::factory()->create(['actor_id' => $this->administrator->id, 'event' => 'user.deactivated']);

    $this->actingAs($this->administrator)
        ->get(route('admin.audit-logs.index', ['event' => 'user.deactivated']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/audit-logs/index')
            ->has('logs.data', 1)
            ->where('logs.data.0.event', 'user.deactivated'));
});

test('successful login records metadata and inactive users cannot authenticate', function () {
    $user = User::factory()->create(['email' => 'login@example.com', 'username' => 'login-user']);

    $this->post(route('login'), ['email' => 'login-user', 'password' => 'password'])->assertRedirect();
    expect($user->refresh()->last_login_at)->not->toBeNull();
    expect(AuditLog::query()->where('event', 'auth.login')->where('actor_id', $user->id)->exists())->toBeTrue();

    auth()->logout();
    $user->update(['status' => 'inactive', 'deactivated_at' => now()]);
    $this->post(route('login'), ['email' => 'login@example.com', 'password' => 'password'])->assertSessionHasErrors('email');
    $this->assertGuest();
});
