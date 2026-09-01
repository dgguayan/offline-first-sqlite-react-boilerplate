<?php

use App\Models\AuditLog;
use App\Models\BrandingSetting;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('public');
    $this->administrator = User::factory()->create();
    $this->seed(RbacSeeder::class);
    $this->branding = BrandingSetting::query()->firstOrFail();
});

test('appearance shares branding and its management permission with the administrator', function () {
    $this->actingAs($this->administrator)
        ->get(route('appearance.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/appearance')
            ->where('branding.systemName', config('app.name'))
            ->where('branding.logoUrl', null)
            ->where('branding.layout', BrandingSetting::Horizontal)
            ->where('branding.titleAlignment', BrandingSetting::AlignLeft)
            ->where('branding.titleOverflow', BrandingSetting::OverflowEllipsis)
            ->where('branding.sidebarLogoSize', BrandingSetting::DefaultSidebarLogoSize)
            ->where('branding.usesCustomLogo', false)
            ->where('auth.permissions', fn (Collection $permissions): bool => $permissions->get('settings.manage-branding') === 'all'));
});

test('the guest login screen receives the saved branding adjustments', function () {
    $this->actingAs($this->administrator)
        ->post(route('branding.update'), [
            'system_name' => 'Configured Login',
            'layout' => BrandingSetting::Vertical,
            'title_alignment' => BrandingSetting::AlignCenter,
            'title_overflow' => BrandingSetting::OverflowWrap,
            'sidebar_logo_size' => 127,
            'remove_logo' => false,
            'logo' => UploadedFile::fake()->image('login-logo.png', 127, 127),
        ])
        ->assertSessionHasNoErrors();

    $logoPath = $this->branding->refresh()->logo_path;
    $this->post(route('logout'))->assertRedirect();

    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/login')
            ->where('branding.systemName', 'Configured Login')
            ->where('branding.logoUrl', fn (string $logoUrl): bool => str_starts_with($logoUrl, "/storage/{$logoPath}?v="))
            ->where('branding.layout', BrandingSetting::Vertical)
            ->where('branding.titleAlignment', BrandingSetting::AlignCenter)
            ->where('branding.titleOverflow', BrandingSetting::OverflowWrap)
            ->where('branding.sidebarLogoSize', 127)
            ->where('branding.usesCustomLogo', true));
});

test('an administrator can update the system name and branding layout', function () {
    $this->actingAs($this->administrator)
        ->from(route('appearance.edit'))
        ->post(route('branding.update'), [
            'system_name' => 'My Management System',
            'layout' => BrandingSetting::Vertical,
            'title_alignment' => BrandingSetting::AlignRight,
            'title_overflow' => BrandingSetting::OverflowWrap,
            'sidebar_logo_size' => BrandingSetting::MaximumSidebarLogoSize,
            'remove_logo' => false,
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('appearance.edit'));

    expect($this->branding->refresh())
        ->system_name->toBe('My Management System')
        ->layout->toBe(BrandingSetting::Vertical)
        ->title_alignment->toBe(BrandingSetting::AlignRight)
        ->title_overflow->toBe(BrandingSetting::OverflowWrap)
        ->sidebar_logo_size->toBe(BrandingSetting::MaximumSidebarLogoSize)
        ->use_custom_logo->toBeFalse()
        ->updated_by->toBe($this->administrator->id);

    expect(AuditLog::query()
        ->where('actor_id', $this->administrator->id)
        ->where('event', 'branding.updated')
        ->where('subject_type', BrandingSetting::class)
        ->where('subject_id', (string) $this->branding->id)
        ->exists())->toBeTrue();
});

test('title display and sidebar logo size only accept supported values', function () {
    $this->actingAs($this->administrator)
        ->from(route('appearance.edit'))
        ->post(route('branding.update'), [
            'system_name' => 'Invalid Display',
            'layout' => BrandingSetting::Horizontal,
            'title_alignment' => 'justify',
            'title_overflow' => 'scroll',
            'sidebar_logo_size' => BrandingSetting::MaximumSidebarLogoSize + 1,
            'remove_logo' => false,
        ])
        ->assertSessionHasErrors(['title_alignment', 'title_overflow', 'sidebar_logo_size']);

    expect($this->branding->refresh())
        ->system_name->toBe(config('app.name'))
        ->title_alignment->toBe(BrandingSetting::AlignLeft)
        ->title_overflow->toBe(BrandingSetting::OverflowEllipsis)
        ->sidebar_logo_size->toBe(BrandingSetting::DefaultSidebarLogoSize);
});

test('users without the branding permission cannot call update or reset routes', function () {
    $ordinaryUser = User::factory()->create();

    $this->actingAs($ordinaryUser)
        ->post(route('branding.update'), [
            'system_name' => 'Escalated name',
            'layout' => BrandingSetting::TitleOnly,
            'title_alignment' => BrandingSetting::AlignLeft,
            'title_overflow' => BrandingSetting::OverflowEllipsis,
            'sidebar_logo_size' => BrandingSetting::DefaultSidebarLogoSize,
            'remove_logo' => false,
        ])
        ->assertForbidden();

    $this->actingAs($ordinaryUser)
        ->delete(route('branding.reset'))
        ->assertForbidden();

    expect($this->branding->refresh()->system_name)->toBe(config('app.name'));
});

test('an administrator can upload and replace a custom logo', function () {
    $this->actingAs($this->administrator)
        ->from(route('appearance.edit'))
        ->post(route('branding.update'), [
            'system_name' => 'Branded Workspace',
            'layout' => BrandingSetting::Horizontal,
            'title_alignment' => BrandingSetting::AlignLeft,
            'title_overflow' => BrandingSetting::OverflowEllipsis,
            'sidebar_logo_size' => BrandingSetting::DefaultSidebarLogoSize,
            'remove_logo' => false,
            'logo' => UploadedFile::fake()->image('first-logo.png', 80, 80)->size(200),
        ])
        ->assertSessionHasNoErrors();

    $firstLogoPath = $this->branding->refresh()->logo_path;
    expect($firstLogoPath)->not->toBeNull();
    Storage::disk('public')->assertExists($firstLogoPath);

    $this->actingAs($this->administrator)
        ->from(route('appearance.edit'))
        ->post(route('branding.update'), [
            'system_name' => 'Branded Workspace',
            'layout' => BrandingSetting::Horizontal,
            'title_alignment' => BrandingSetting::AlignLeft,
            'title_overflow' => BrandingSetting::OverflowEllipsis,
            'sidebar_logo_size' => BrandingSetting::DefaultSidebarLogoSize,
            'remove_logo' => false,
            'logo' => UploadedFile::fake()->image('second-logo.webp', 100, 60)->size(250),
        ])
        ->assertSessionHasNoErrors();

    $secondLogoPath = $this->branding->refresh()->logo_path;
    expect($secondLogoPath)
        ->not->toBeNull()
        ->not->toBe($firstLogoPath)
        ->and($this->branding->use_custom_logo)->toBeTrue();
    Storage::disk('public')->assertMissing($firstLogoPath);
    Storage::disk('public')->assertExists($secondLogoPath);
});

test('a safe svg logo is accepted and unsafe svg content is rejected', function () {
    $safeSvg = UploadedFile::fake()->createWithContent(
        'logo.svg',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path fill="#111" d="M0 0h40v40H0z"/></svg>',
    )->mimeType('image/svg+xml');

    $this->actingAs($this->administrator)
        ->from(route('appearance.edit'))
        ->post(route('branding.update'), [
            'system_name' => 'Safe SVG',
            'layout' => BrandingSetting::LogoOnly,
            'title_alignment' => BrandingSetting::AlignLeft,
            'title_overflow' => BrandingSetting::OverflowEllipsis,
            'sidebar_logo_size' => BrandingSetting::DefaultSidebarLogoSize,
            'remove_logo' => false,
            'logo' => $safeSvg,
        ])
        ->assertSessionHasNoErrors();

    $safeLogoPath = $this->branding->refresh()->logo_path;
    Storage::disk('public')->assertExists($safeLogoPath);

    $unsafeSvg = UploadedFile::fake()->createWithContent(
        'unsafe.svg',
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    )->mimeType('image/svg+xml');

    $this->actingAs($this->administrator)
        ->from(route('appearance.edit'))
        ->post(route('branding.update'), [
            'system_name' => 'Unsafe SVG',
            'layout' => BrandingSetting::LogoOnly,
            'title_alignment' => BrandingSetting::AlignLeft,
            'title_overflow' => BrandingSetting::OverflowEllipsis,
            'sidebar_logo_size' => BrandingSetting::DefaultSidebarLogoSize,
            'remove_logo' => false,
            'logo' => $unsafeSvg,
        ])
        ->assertSessionHasErrors('logo');

    expect($this->branding->refresh()->logo_path)->toBe($safeLogoPath);
});

test('logo uploads enforce the supported types and two megabyte limit', function () {
    $this->actingAs($this->administrator)
        ->from(route('appearance.edit'))
        ->post(route('branding.update'), [
            'system_name' => 'Too Large',
            'layout' => BrandingSetting::Horizontal,
            'title_alignment' => BrandingSetting::AlignLeft,
            'title_overflow' => BrandingSetting::OverflowEllipsis,
            'sidebar_logo_size' => BrandingSetting::DefaultSidebarLogoSize,
            'remove_logo' => false,
            'logo' => UploadedFile::fake()->image('large.png')->size(2049),
        ])
        ->assertSessionHasErrors('logo');

    $this->actingAs($this->administrator)
        ->from(route('appearance.edit'))
        ->post(route('branding.update'), [
            'system_name' => 'Wrong Type',
            'layout' => BrandingSetting::Horizontal,
            'title_alignment' => BrandingSetting::AlignLeft,
            'title_overflow' => BrandingSetting::OverflowEllipsis,
            'sidebar_logo_size' => BrandingSetting::DefaultSidebarLogoSize,
            'remove_logo' => false,
            'logo' => UploadedFile::fake()->create('logo.txt', 10, 'text/plain'),
        ])
        ->assertSessionHasErrors('logo');
});

test('an administrator can remove a custom logo while keeping the other branding', function () {
    Storage::disk('public')->put('branding/existing.png', 'logo');
    $this->branding->update([
        'system_name' => 'Keep This Name',
        'logo_path' => 'branding/existing.png',
        'layout' => BrandingSetting::Vertical,
        'title_alignment' => BrandingSetting::AlignCenter,
        'title_overflow' => BrandingSetting::OverflowClip,
        'sidebar_logo_size' => 48,
        'use_custom_logo' => true,
    ]);

    $this->actingAs($this->administrator)
        ->from(route('appearance.edit'))
        ->post(route('branding.update'), [
            'system_name' => 'Keep This Name',
            'layout' => BrandingSetting::Vertical,
            'title_alignment' => BrandingSetting::AlignCenter,
            'title_overflow' => BrandingSetting::OverflowClip,
            'sidebar_logo_size' => 48,
            'remove_logo' => true,
        ])
        ->assertSessionHasNoErrors();

    expect($this->branding->refresh())
        ->system_name->toBe('Keep This Name')
        ->layout->toBe(BrandingSetting::Vertical)
        ->title_alignment->toBe(BrandingSetting::AlignCenter)
        ->title_overflow->toBe(BrandingSetting::OverflowClip)
        ->sidebar_logo_size->toBe(48)
        ->logo_path->toBeNull()
        ->use_custom_logo->toBeFalse();
    Storage::disk('public')->assertMissing('branding/existing.png');
});

test('reset restores all branding defaults after confirmation', function () {
    Storage::disk('public')->put('branding/custom.png', 'logo');
    $this->branding->update([
        'system_name' => 'Custom Name',
        'logo_path' => 'branding/custom.png',
        'layout' => BrandingSetting::TitleOnly,
        'title_alignment' => BrandingSetting::AlignRight,
        'title_overflow' => BrandingSetting::OverflowWrap,
        'sidebar_logo_size' => 64,
        'use_custom_logo' => true,
        'updated_by' => $this->administrator->id,
    ]);

    $this->actingAs($this->administrator)
        ->from(route('appearance.edit'))
        ->delete(route('branding.reset'))
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('appearance.edit'));

    expect($this->branding->refresh())
        ->system_name->toBe(config('app.name'))
        ->layout->toBe(BrandingSetting::Horizontal)
        ->title_alignment->toBe(BrandingSetting::AlignLeft)
        ->title_overflow->toBe(BrandingSetting::OverflowEllipsis)
        ->sidebar_logo_size->toBe(BrandingSetting::DefaultSidebarLogoSize)
        ->logo_path->toBeNull()
        ->use_custom_logo->toBeFalse();
    Storage::disk('public')->assertMissing('branding/custom.png');
    expect(AuditLog::query()->where('event', 'branding.reset')->exists())->toBeTrue();
});
