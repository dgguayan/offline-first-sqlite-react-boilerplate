<?php

namespace Database\Factories;

use App\Models\Permission;
use App\Models\PermissionModule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Permission>
 */
class PermissionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $resource = fake()->unique()->word();
        $action = fake()->randomElement(['view', 'create', 'edit', 'delete', 'export']);

        return [
            'permission_module_id' => PermissionModule::factory(),
            'name' => ucfirst($action).' '.ucfirst($resource),
            'slug' => $resource.'.'.$action,
            'action' => $action,
            'description' => fake()->sentence(),
            'allowed_scopes' => ['all'],
        ];
    }
}
