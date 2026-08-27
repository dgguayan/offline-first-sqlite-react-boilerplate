<?php

use App\Models\User;
use Database\Seeders\RbacSeeder;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $user = User::factory()->create();
    $this->seed(RbacSeeder::class);
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertOk();
});
