<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $now = now();
        $moduleId = DB::table('permission_modules')->where('slug', 'settings')->value('id');

        if ($moduleId === null) {
            $moduleId = DB::table('permission_modules')->insertGetId([
                'name' => 'Settings',
                'slug' => 'settings',
                'description' => 'Global application configuration and system branding.',
                'sort_order' => 40,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $permissionId = DB::table('permissions')->where('slug', 'settings.manage-branding')->value('id');

        if ($permissionId === null) {
            $permissionId = DB::table('permissions')->insertGetId([
                'permission_module_id' => $moduleId,
                'name' => 'Manage system branding',
                'slug' => 'settings.manage-branding',
                'action' => 'manage-branding',
                'description' => 'Change the system name, logo, and branding layout.',
                'allowed_scopes' => json_encode(['all'], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $administratorRoleId = DB::table('roles')->where('slug', 'administrator')->value('id');

        if ($administratorRoleId !== null) {
            DB::table('permission_role')->updateOrInsert(
                [
                    'permission_id' => $permissionId,
                    'role_id' => $administratorRoleId,
                ],
                [
                    'scope' => 'all',
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $permissionId = DB::table('permissions')->where('slug', 'settings.manage-branding')->value('id');

        if ($permissionId !== null) {
            DB::table('permission_role')->where('permission_id', $permissionId)->delete();
            DB::table('permissions')->where('id', $permissionId)->delete();
        }

        $moduleId = DB::table('permission_modules')->where('slug', 'settings')->value('id');

        if ($moduleId !== null && ! DB::table('permissions')->where('permission_module_id', $moduleId)->exists()) {
            DB::table('permission_modules')->where('id', $moduleId)->delete();
        }
    }
};
