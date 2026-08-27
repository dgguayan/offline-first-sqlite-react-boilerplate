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
        $deletePermissionId = DB::table('permissions')
            ->where('slug', 'workspace.delete-any')
            ->value('id');
        $archivePermissionId = DB::table('permissions')
            ->where('slug', 'workspace.archive-any')
            ->value('id');

        if ($archivePermissionId === null && $deletePermissionId !== null) {
            DB::table('permissions')
                ->where('id', $deletePermissionId)
                ->update([
                    'name' => 'Archive any workspace data',
                    'slug' => 'workspace.archive-any',
                    'action' => 'archive-any',
                    'description' => 'Archive projects and tasks belonging to any user.',
                    'updated_at' => $now,
                ]);
            $archivePermissionId = $deletePermissionId;
        }

        if ($archivePermissionId === null) {
            $archivePermissionId = DB::table('permissions')->insertGetId([
                'permission_module_id' => $moduleId,
                'name' => 'Archive any workspace data',
                'slug' => 'workspace.archive-any',
                'action' => 'archive-any',
                'description' => 'Archive projects and tasks belonging to any user.',
                'allowed_scopes' => json_encode(['all'], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $restorePermissionId = DB::table('permissions')
            ->where('slug', 'workspace.restore-any')
            ->value('id');

        if ($restorePermissionId === null) {
            $restorePermissionId = DB::table('permissions')->insertGetId([
                'permission_module_id' => $moduleId,
                'name' => 'Restore any workspace data',
                'slug' => 'workspace.restore-any',
                'action' => 'restore-any',
                'description' => 'Restore archived projects and tasks belonging to any user.',
                'allowed_scopes' => json_encode(['all'], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $administratorRoleId = DB::table('roles')
            ->where('slug', 'administrator')
            ->value('id');

        if ($administratorRoleId !== null) {
            foreach ([$archivePermissionId, $restorePermissionId] as $permissionId) {
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
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $restorePermissionId = DB::table('permissions')
            ->where('slug', 'workspace.restore-any')
            ->value('id');

        if ($restorePermissionId !== null) {
            DB::table('permission_role')->where('permission_id', $restorePermissionId)->delete();
            DB::table('permissions')->where('id', $restorePermissionId)->delete();
        }

        DB::table('permissions')
            ->where('slug', 'workspace.archive-any')
            ->update([
                'name' => 'Delete any workspace data',
                'slug' => 'workspace.delete-any',
                'action' => 'delete-any',
                'description' => 'Delete projects and tasks belonging to any user.',
                'updated_at' => now(),
            ]);
    }
};
