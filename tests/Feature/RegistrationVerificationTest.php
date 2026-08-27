<?php

use App\Models\AuditLog;
use App\Models\RegistrationSetting;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Illuminate\Http\Request;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Passkeys\Passkey;
use Laravel\Passkeys\Passkeys;

beforeEach(function () {
    $this->administrator = User::factory()->create();
    $this->seed(RbacSeeder::class);
});

test('pending and declined registrations cannot authenticate or access protected routes', function () {
    $pending = User::factory()->pendingVerification()->create([
        'email' => 'pending@example.com',
    ]);

    $this->post(route('login.store'), [
        'email' => $pending->email,
        'password' => 'password',
    ])->assertSessionHasErrors('email');
    $this->assertGuest();

    $declined = User::factory()->pendingVerification()->create([
        'status' => User::StatusDeclined,
        'declined_at' => now(),
    ]);

    $this->actingAs($declined)
        ->get(route('dashboard'))
        ->assertRedirect(route('login'));
    $this->assertGuest();
});

test('passkey authentication also rejects accounts that are not approved and active', function () {
    $pending = User::factory()->pendingVerification()->create();
    $active = User::factory()->create();
    $passkey = new Passkey;

    $passkey->setRelation('user', $pending);
    expect(Passkeys::allowsLogin(Request::create('/'), $passkey))->toBeFalse();

    $passkey->setRelation('user', $active);
    expect(Passkeys::allowsLogin(Request::create('/'), $passkey))->toBeTrue();
});

test('registration verification pages and actions require explicit database permissions', function () {
    $ordinaryUser = User::factory()->create();
    $ordinaryUser->roles()->attach(Role::query()->where('is_default', true)->firstOrFail());
    $pending = User::factory()->pendingVerification()->create();

    $this->actingAs($ordinaryUser)->get(route('admin.registrations.index'))->assertForbidden();
    $this->actingAs($ordinaryUser)->patch(route('admin.registrations.approve', $pending))->assertForbidden();
    $this->actingAs($ordinaryUser)->put(route('admin.registration-settings.update'), [
        'pending_expiration_days' => 14,
    ])->assertForbidden();

    $this->actingAs($ordinaryUser)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.pending_registration_count', 0));

    $this->actingAs($this->administrator)
        ->get(route('admin.registrations.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/registrations/index')
            ->has('registrations.data', 1)
            ->where('registrations.data.0.status', User::StatusPending)
            ->where('auth.pending_registration_count', 1));
});

test('an administrator can approve a pending registration and grants the active default role', function () {
    $pending = User::factory()->pendingVerification()->create();

    $this->actingAs($this->administrator)
        ->patch(route('admin.registrations.approve', $pending))
        ->assertSessionHasNoErrors();

    $pending->refresh();

    expect($pending->status)->toBe(User::StatusActive)
        ->and($pending->approved_by)->toBe($this->administrator->id)
        ->and($pending->approved_at)->not->toBeNull()
        ->and($pending->roles()->where('is_default', true)->exists())->toBeTrue()
        ->and(AuditLog::query()->where('event', 'registration.approved')->where('subject_id', $pending->id)->exists())->toBeTrue();

    $this->post(route('logout'));
    $this->post(route('login.store'), [
        'email' => $pending->email,
        'password' => 'password',
    ])->assertRedirect(route('dashboard', absolute: false));
    $this->assertAuthenticatedAs($pending);
});

test('an administrator can decline a pending registration with an audited reason', function () {
    $pending = User::factory()->pendingVerification()->create();

    $this->actingAs($this->administrator)
        ->patch(route('admin.registrations.decline', $pending), [
            'reason' => 'Not an authorized member of the organization.',
        ])
        ->assertSessionHasNoErrors();

    $pending->refresh();

    expect($pending->status)->toBe(User::StatusDeclined)
        ->and($pending->declined_by)->toBe($this->administrator->id)
        ->and($pending->decline_reason)->toBe('Not an authorized member of the organization.')
        ->and($pending->roles()->exists())->toBeFalse()
        ->and(AuditLog::query()->where('event', 'registration.declined')->where('subject_id', $pending->id)->exists())->toBeTrue();
});

test('registration expiration setting is positive permission protected and audited', function () {
    $this->actingAs($this->administrator)
        ->put(route('admin.registration-settings.update'), ['pending_expiration_days' => 0])
        ->assertSessionHasErrors('pending_expiration_days');

    $this->actingAs($this->administrator)
        ->put(route('admin.registration-settings.update'), ['pending_expiration_days' => 14])
        ->assertSessionHasNoErrors();

    expect(RegistrationSetting::current()->pending_expiration_days)->toBe(14)
        ->and(AuditLog::query()->where('event', 'registration.settings_updated')->exists())->toBeTrue();
});

test('expired registrations are declined deleted and retain only an idempotent audit trail', function () {
    $expired = User::factory()->pendingVerification()->create([
        'email' => 'expired@example.com',
        'verification_expires_at' => now()->subMinute(),
    ]);

    $this->artisan('users:expire-pending-registrations')
        ->expectsOutput('Expired 1 pending registration(s).')
        ->assertSuccessful();

    expect(User::query()->find($expired->id))->toBeNull()
        ->and(AuditLog::query()->where('event', 'registration.auto_declined')->where('subject_id', $expired->id)->exists())->toBeTrue()
        ->and(AuditLog::query()->where('event', 'registration.expired_deleted')->where('subject_id', $expired->id)->count())->toBe(1);

    $expirationAudit = AuditLog::query()->where('event', 'registration.expired_deleted')->firstOrFail();
    expect($expirationAudit->metadata['email'])->toBe('expired@example.com')
        ->and($expirationAudit->actor_id)->toBeNull();

    $this->artisan('users:expire-pending-registrations')
        ->expectsOutput('Expired 0 pending registration(s).')
        ->assertSuccessful();

    expect(AuditLog::query()->where('event', 'registration.expired_deleted')->where('subject_id', $expired->id)->count())->toBe(1);
});

test('an expired pending registration cannot be approved before scheduled cleanup runs', function () {
    $expired = User::factory()->pendingVerification()->create([
        'verification_expires_at' => now()->subSecond(),
    ]);

    $this->actingAs($this->administrator)
        ->patch(route('admin.registrations.approve', $expired))
        ->assertSessionHasErrors('registration');

    expect(User::query()->find($expired->id))->toBeNull()
        ->and(AuditLog::query()->where('event', 'registration.expired_deleted')->where('subject_id', $expired->id)->exists())->toBeTrue();
});
