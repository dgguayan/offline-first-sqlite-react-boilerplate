<?php

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\PermissionCatalogController;
use App\Http\Controllers\Admin\RegistrationVerificationController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\WorkspaceDataController;
use App\Http\Controllers\SyncController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->middleware('can:dashboard.view')->name('dashboard');

    Route::inertia('projects', 'project')->middleware('can:projects.view')->name('projects');

    Route::prefix('admin')->name('admin.')->group(function () {
        Route::resource('users', UserController::class);
        Route::patch('users/{user}/activate', [UserController::class, 'activate'])->name('users.activate');
        Route::patch('users/{user}/deactivate', [UserController::class, 'deactivate'])->name('users.deactivate');
        Route::put('users/{user}/roles', [UserController::class, 'updateRoles'])->name('users.roles.update');
        Route::post('users/{user}/password-reset', [UserController::class, 'sendPasswordReset'])->name('users.password-reset');

        Route::controller(RegistrationVerificationController::class)
            ->prefix('registrations')
            ->name('registrations.')
            ->middleware('can:users.verify-registrations')
            ->group(function (): void {
                Route::get('/', 'index')->name('index');
                Route::patch('{user}/approve', 'approve')->name('approve');
                Route::patch('{user}/decline', 'decline')->name('decline');
            });
        Route::put('registration-settings', [RegistrationVerificationController::class, 'updateSetting'])
            ->middleware('can:settings.manage-registration')
            ->name('registration-settings.update');

        Route::resource('roles', RoleController::class);

        Route::get('permissions', [PermissionCatalogController::class, 'index'])->name('permissions.index');
        Route::post('permission-modules', [PermissionCatalogController::class, 'storeModule'])->name('permission-modules.store');
        Route::put('permission-modules/{permissionModule}', [PermissionCatalogController::class, 'updateModule'])->name('permission-modules.update');
        Route::delete('permission-modules/{permissionModule}', [PermissionCatalogController::class, 'destroyModule'])->name('permission-modules.destroy');
        Route::post('permissions', [PermissionCatalogController::class, 'storePermission'])->name('permissions.store');
        Route::put('permissions/{permission}', [PermissionCatalogController::class, 'updatePermission'])->name('permissions.update');
        Route::delete('permissions/{permission}', [PermissionCatalogController::class, 'destroyPermission'])->name('permissions.destroy');

        Route::get('audit-logs', AuditLogController::class)->name('audit-logs.index');
        Route::get('workspace-data', WorkspaceDataController::class)->name('workspace-data.index');
        Route::patch('workspace-data/{type}/{id}/archive', [WorkspaceDataController::class, 'archive'])
            ->whereIn('type', ['tasks', 'projects'])
            ->name('workspace-data.archive');
        Route::patch('workspace-data/{type}/{id}/restore', [WorkspaceDataController::class, 'restore'])
            ->whereIn('type', ['tasks', 'projects'])
            ->name('workspace-data.restore');
    });

    Route::prefix('api/sync')->name('sync.')->group(function () {
        Route::get('health', [SyncController::class, 'health'])->name('health');
        Route::post('push', [SyncController::class, 'push'])->name('push');
        Route::get('pull', [SyncController::class, 'pull'])->name('pull');
    });
});

require __DIR__.'/settings.php';
