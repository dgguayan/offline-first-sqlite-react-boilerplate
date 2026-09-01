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

        $tasksPermissionId = DB::table('permissions')
            ->where('slug', 'tasks.view')
            ->value('id');

        if ($tasksPermissionId === null) {
            $tasksPermissionId = DB::table('permissions')->insertGetId([
                'permission_module_id' => $moduleId,
                'name' => 'View tasks',
                'slug' => 'tasks.view',
                'action' => 'view',
                'description' => 'Access the offline-first task workspace.',
                'allowed_scopes' => json_encode(['own'], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $dashboardPermissionId = DB::table('permissions')
            ->where('slug', 'dashboard.view')
            ->value('id');
        $roleIds = $dashboardPermissionId === null
            ? collect()
            : DB::table('permission_role')
                ->where('permission_id', $dashboardPermissionId)
                ->pluck('role_id');

        foreach ($roleIds as $roleId) {
            DB::table('permission_role')->updateOrInsert(
                [
                    'permission_id' => $tasksPermissionId,
                    'role_id' => $roleId,
                ],
                [
                    'scope' => 'own',
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
        $tasksPermissionId = DB::table('permissions')
            ->where('slug', 'tasks.view')
            ->value('id');

        if ($tasksPermissionId === null) {
            return;
        }

        DB::table('permission_role')
            ->where('permission_id', $tasksPermissionId)
            ->delete();
        DB::table('permissions')->where('id', $tasksPermissionId)->delete();
    }
};
