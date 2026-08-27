<?php

use App\Models\AuditLog;
use App\Models\RegistrationSetting;
use App\Models\User;
use Laravel\Fortify\Features;

beforeEach(function () {
    $this->skipUnlessFortifyHas(Features::registration());
});

test('registration screen can be rendered', function () {
    $response = $this->get(route('register'));

    $response->assertOk();
});

test('new self-registered users remain pending administrator approval', function () {
    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $user = User::query()->where('email', 'test@example.com')->firstOrFail();

    $this->assertGuest();
    $response
        ->assertRedirect(route('login'))
        ->assertSessionHas('status', 'Registration submitted. An administrator must approve your account before you can sign in.');
    expect($user->status)->toBe(User::StatusPending)
        ->and($user->registration_source)->toBe(User::RegistrationSourceSelf)
        ->and($user->roles()->exists())->toBeFalse()
        ->and($user->last_login_at)->toBeNull()
        ->and((int) $user->created_at?->diffInDays($user->verification_expires_at))->toBe(RegistrationSetting::DefaultPendingExpirationDays)
        ->and(AuditLog::query()->where('event', 'registration.submitted')->where('subject_id', $user->id)->exists())->toBeTrue()
        ->and(AuditLog::query()->where('event', 'auth.login')->where('subject_id', $user->id)->exists())->toBeFalse();
});
