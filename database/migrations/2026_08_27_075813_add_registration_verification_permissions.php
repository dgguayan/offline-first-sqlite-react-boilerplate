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
        $usersModuleId = $this->moduleId('users', 'Users', 'User accounts, status, credentials, and role assignments.', 10, $now);
        $settingsModuleId = $this->moduleId('settings', 'Settings', 'Global application configuration and system branding.', 40, $now);

        $permissionIds = [
            $this->permissionId(
                $usersModuleId,
                'Verify registrations',
                'users.verify-registrations',
                'verify-registrations',
                'Review, approve, and decline self-registered accounts.',
                $now,
            ),
            $this->permissionId(
                $settingsModuleId,
                'Manage registration settings',
                'settings.manage-registration',
                'manage-registration',
                'Configure the pending-registration expiration period.',
                $now,
            ),
        ];

        $administratorRoleId = DB::table('roles')->where('slug', 'administrator')->value('id');

        if ($administratorRoleId !== null) {
            foreach ($permissionIds as $permissionId) {
                DB::table('permission_role')->updateOrInsert(
                    ['permission_id' => $permissionId, 'role_id' => $administratorRoleId],
                    ['scope' => 'all', 'created_at' => $now, 'updated_at' => $now],
                );
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $permissionIds = DB::table('permissions')
            ->whereIn('slug', ['users.verify-registrations', 'settings.manage-registration'])
            ->pluck('id');

        DB::table('permission_role')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
    }

    private function moduleId(
        string $slug,
        string $name,
        string $description,
        int $sortOrder,
        mixed $now,
    ): int {
        $moduleId = DB::table('permission_modules')->where('slug', $slug)->value('id');

        if ($moduleId !== null) {
            return (int) $moduleId;
        }

        return (int) DB::table('permission_modules')->insertGetId([
            'name' => $name,
            'slug' => $slug,
            'description' => $description,
            'sort_order' => $sortOrder,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    private function permissionId(
        int $moduleId,
        string $name,
        string $slug,
        string $action,
        string $description,
        mixed $now,
    ): int {
        $permissionId = DB::table('permissions')->where('slug', $slug)->value('id');

        if ($permissionId !== null) {
            return (int) $permissionId;
        }

        return (int) DB::table('permissions')->insertGetId([
            'permission_module_id' => $moduleId,
            'name' => $name,
            'slug' => $slug,
            'action' => $action,
            'description' => $description,
            'allowed_scopes' => json_encode(['all'], JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
};
