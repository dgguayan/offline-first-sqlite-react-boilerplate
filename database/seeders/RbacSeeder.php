<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionModule;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RbacSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $catalog = [
            ['name' => 'Workspace', 'slug' => 'workspace', 'description' => 'Core application pages.', 'permissions' => [
                ['name' => 'View dashboard', 'slug' => 'dashboard.view', 'action' => 'view', 'scopes' => ['all']],
                ['name' => 'View projects', 'slug' => 'projects.view', 'action' => 'view', 'scopes' => ['own']],
                ['name' => 'View all workspace data', 'slug' => 'workspace.view-all', 'action' => 'view-all', 'scopes' => ['all']],
                ['name' => 'Archive any workspace data', 'slug' => 'workspace.archive-any', 'action' => 'archive-any', 'scopes' => ['all']],
                ['name' => 'Restore any workspace data', 'slug' => 'workspace.restore-any', 'action' => 'restore-any', 'scopes' => ['all']],
            ]],
            ['name' => 'Users', 'slug' => 'users', 'description' => 'User accounts, status, credentials, and role assignments.', 'permissions' => [
                ['name' => 'View users', 'slug' => 'users.view', 'action' => 'view', 'scopes' => ['all', 'department', 'own']],
                ['name' => 'Create users', 'slug' => 'users.create', 'action' => 'create', 'scopes' => ['all']],
                ['name' => 'Edit users', 'slug' => 'users.edit', 'action' => 'edit', 'scopes' => ['all', 'department', 'own']],
                ['name' => 'Deactivate users', 'slug' => 'users.deactivate', 'action' => 'deactivate', 'scopes' => ['all', 'department']],
                ['name' => 'Delete users', 'slug' => 'users.delete', 'action' => 'delete', 'scopes' => ['all', 'department']],
                ['name' => 'Reset user passwords', 'slug' => 'users.reset-password', 'action' => 'reset-password', 'scopes' => ['all', 'department']],
                ['name' => 'Assign user roles', 'slug' => 'users.assign-roles', 'action' => 'assign-roles', 'scopes' => ['all', 'department']],
                ['name' => 'Verify registrations', 'slug' => 'users.verify-registrations', 'action' => 'verify-registrations', 'scopes' => ['all']],
            ]],
            ['name' => 'Roles', 'slug' => 'roles', 'description' => 'Roles and their effective permission grants.', 'permissions' => [
                ['name' => 'View roles', 'slug' => 'roles.view', 'action' => 'view', 'scopes' => ['all']],
                ['name' => 'Create roles', 'slug' => 'roles.create', 'action' => 'create', 'scopes' => ['all']],
                ['name' => 'Edit roles', 'slug' => 'roles.edit', 'action' => 'edit', 'scopes' => ['all']],
                ['name' => 'Delete roles', 'slug' => 'roles.delete', 'action' => 'delete', 'scopes' => ['all']],
                ['name' => 'Manage role permissions', 'slug' => 'roles.manage-permissions', 'action' => 'manage-permissions', 'scopes' => ['all']],
                ['name' => 'Grant any permission', 'slug' => 'roles.grant-any', 'action' => 'grant-any', 'scopes' => ['all']],
                ['name' => 'Manage permission catalog', 'slug' => 'permissions.manage', 'action' => 'manage', 'scopes' => ['all']],
            ]],
            ['name' => 'Audit logs', 'slug' => 'audit-logs', 'description' => 'Immutable security and administration activity.', 'permissions' => [
                ['name' => 'View audit logs', 'slug' => 'audit-logs.view', 'action' => 'view', 'scopes' => ['all']],
            ]],
            ['name' => 'Settings', 'slug' => 'settings', 'description' => 'Global application configuration and system branding.', 'permissions' => [
                ['name' => 'Manage system branding', 'slug' => 'settings.manage-branding', 'action' => 'manage-branding', 'scopes' => ['all']],
                ['name' => 'Manage registration settings', 'slug' => 'settings.manage-registration', 'action' => 'manage-registration', 'scopes' => ['all']],
            ]],
        ];

        DB::transaction(function () use ($catalog): void {
            foreach ($catalog as $index => $moduleData) {
                $module = PermissionModule::query()->firstOrCreate(
                    ['slug' => $moduleData['slug']],
                    ['name' => $moduleData['name'], 'description' => $moduleData['description'], 'sort_order' => $index * 10],
                );

                foreach ($moduleData['permissions'] as $permissionData) {
                    Permission::query()->firstOrCreate(
                        ['slug' => $permissionData['slug']],
                        [
                            'permission_module_id' => $module->id,
                            'name' => $permissionData['name'],
                            'action' => $permissionData['action'],
                            'description' => null,
                            'allowed_scopes' => $permissionData['scopes'],
                        ],
                    );
                }
            }

            $administrator = Role::query()->firstOrCreate(
                ['slug' => 'administrator'],
                ['name' => 'Administrator', 'description' => 'Initial full-access role. Its name and permissions remain configurable.', 'is_active' => true, 'is_default' => false],
            );
            if ($administrator->wasRecentlyCreated) {
                $administratorGrants = [];

                foreach (Permission::query()->get() as $permission) {
                    $administratorGrants[$permission->id] = [
                        'scope' => in_array('all', $permission->allowed_scopes, true)
                            ? 'all'
                            : ($permission->allowed_scopes[0] ?? 'own'),
                    ];
                }

                $administrator->permissions()->sync($administratorGrants);
            }

            $defaultRole = Role::query()->firstOrCreate(
                ['slug' => 'general-user'],
                ['name' => 'General User', 'description' => 'Default access for newly registered accounts.', 'is_active' => true, 'is_default' => true],
            );
            if ($defaultRole->wasRecentlyCreated) {
                $defaultPermissions = Permission::query()->whereIn('slug', ['dashboard.view', 'projects.view'])->get();
                $defaultRole->permissions()->sync(
                    $defaultPermissions->mapWithKeys(fn (Permission $permission): array => [
                        $permission->id => ['scope' => $permission->slug === 'projects.view' ? 'own' : 'all'],
                    ]),
                );
            }

            if (! DB::table('role_user')->exists()) {
                $firstUser = User::query()->oldest('id')->first();
                $firstUser?->roles()->attach($administrator->id, ['assigned_by' => $firstUser->id]);
            }
        });
    }
}
