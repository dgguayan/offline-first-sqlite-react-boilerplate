<?php

use App\Http\Controllers\SyncController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::inertia('projects', 'project')->name('projects');

    Route::prefix('api/sync')->name('sync.')->group(function () {
        Route::get('health', [SyncController::class, 'health'])->name('health');
        Route::post('push', [SyncController::class, 'push'])->name('push');
        Route::get('pull', [SyncController::class, 'pull'])->name('pull');
    });
});

require __DIR__.'/settings.php';
