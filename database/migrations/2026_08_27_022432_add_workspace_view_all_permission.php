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
        $moduleId = DB::table('permission_modules')
            ->where('slug', 'workspace')
            ->value('id');

        if ($moduleId === null) {
            $moduleId = DB::table('permission_modules')->insertGetId([
                'name' => 'Workspace',
                'slug' => 'workspace',
                'description' => 'Core application pages.',
                'sort_order' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $permissionId = DB::table('permissions')
            ->where('slug', 'workspace.view-all')
            ->value('id');

        if ($permissionId === null) {
            $permissionId = DB::table('permissions')->insertGetId([
                'permission_module_id' => $moduleId,
                'name' => 'View all workspace data',
                'slug' => 'workspace.view-all',
                'action' => 'view-all',
                'description' => 'View projects and tasks belonging to every user.',
                'allowed_scopes' => json_encode(['all'], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $administratorRoleId = DB::table('roles')
            ->where('slug', 'administrator')
            ->value('id');

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
        $permissionId = DB::table('permissions')
            ->where('slug', 'workspace.view-all')
            ->value('id');

        if ($permissionId === null) {
            return;
        }

        DB::table('permission_role')
            ->where('permission_id', $permissionId)
            ->delete();
        DB::table('permissions')->where('id', $permissionId)->delete();
    }
};
