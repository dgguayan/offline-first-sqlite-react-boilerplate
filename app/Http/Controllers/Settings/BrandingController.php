<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ResetBrandingRequest;
use App\Http\Requests\Settings\UpdateBrandingRequest;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\BrandingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use RuntimeException;
use Throwable;

class BrandingController extends Controller
{
    public function update(
        UpdateBrandingRequest $request,
        BrandingService $brandingService,
        AuditLogger $auditLogger,
    ): RedirectResponse {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $branding = $brandingService->current();
        $oldValues = $brandingService->snapshot($branding);
        $oldLogoPath = $branding->logo_path;
        $newLogoPath = $request->boolean('remove_logo') ? null : $oldLogoPath;
        $storedLogoPath = null;
        $uploadedLogo = $request->file('logo');

        if ($uploadedLogo instanceof UploadedFile) {
            $storedLogoPath = $uploadedLogo->storePublicly('branding', 'public');

            if (! is_string($storedLogoPath)) {
                throw new RuntimeException('The branding logo could not be stored.');
            }

            $newLogoPath = $storedLogoPath;
        }

        try {
            DB::transaction(function () use (
                $actor,
                $auditLogger,
                $branding,
                $brandingService,
                $newLogoPath,
                $oldValues,
                $request,
            ): void {
                $branding->fill([
                    'system_name' => (string) $request->validated('system_name'),
                    'logo_path' => $newLogoPath,
                    'layout' => (string) $request->validated('layout'),
                    'title_alignment' => (string) $request->validated('title_alignment'),
                    'title_overflow' => (string) $request->validated('title_overflow'),
                    'sidebar_logo_size' => (int) $request->validated('sidebar_logo_size'),
                    'use_custom_logo' => $newLogoPath !== null,
                    'updated_by' => $actor->id,
                ])->save();

                $auditLogger->record(
                    $actor,
                    'branding.updated',
                    $branding,
                    $oldValues,
                    $brandingService->snapshot($branding),
                );
            });
        } catch (Throwable $exception) {
            if ($storedLogoPath !== null) {
                Storage::disk('public')->delete($storedLogoPath);
            }

            throw $exception;
        }

        if ($oldLogoPath !== null && $oldLogoPath !== $newLogoPath) {
            Storage::disk('public')->delete($oldLogoPath);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'System branding updated.']);

        return back();
    }

    public function reset(
        ResetBrandingRequest $request,
        BrandingService $brandingService,
        AuditLogger $auditLogger,
    ): RedirectResponse {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $branding = $brandingService->current();
        $oldValues = $brandingService->snapshot($branding);
        $oldLogoPath = $branding->logo_path;

        DB::transaction(function () use (
            $actor,
            $auditLogger,
            $branding,
            $brandingService,
            $oldValues,
        ): void {
            $branding->fill([
                ...$brandingService->defaults(),
                'updated_by' => $actor->id,
            ])->save();

            $auditLogger->record(
                $actor,
                'branding.reset',
                $branding,
                $oldValues,
                $brandingService->snapshot($branding),
            );
        });

        if ($oldLogoPath !== null) {
            Storage::disk('public')->delete($oldLogoPath);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'System branding restored to its defaults.']);

        return back();
    }
}
