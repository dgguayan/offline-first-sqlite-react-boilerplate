<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StorePermissionModuleRequest;
use App\Http\Requests\Admin\StorePermissionRequest;
use App\Http\Requests\Admin\UpdatePermissionModuleRequest;
use App\Http\Requests\Admin\UpdatePermissionRequest;
use App\Models\Permission;
use App\Models\PermissionModule;
use App\Services\AuditLogger;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class PermissionCatalogController extends Controller
{
    public function __construct(private AuditLogger $auditLogger) {}

    public function index(): Response
    {
        Gate::authorize('permissions.manage');

        return Inertia::render('admin/permissions/index', [
            'modules' => PermissionModule::query()
                ->with(['permissions' => fn ($query) => $query->withCount('roles')->orderBy('name')])
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function storeModule(StorePermissionModuleRequest $request): RedirectResponse
    {
        $module = PermissionModule::query()->create($request->validated());
        $this->auditLogger->record($request->user(), 'permission_module.created', $module, null, $module->toArray());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Permission module created.']);

        return back();
    }

    public function updateModule(UpdatePermissionModuleRequest $request, PermissionModule $permissionModule): RedirectResponse
    {
        $before = $permissionModule->toArray();
        $permissionModule->update($request->validated());
        $this->auditLogger->record($request->user(), 'permission_module.updated', $permissionModule, $before, $permissionModule->fresh()->toArray());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Permission module updated.']);

        return back();
    }

    public function destroyModule(Request $request, PermissionModule $permissionModule): RedirectResponse
    {
        Gate::authorize('permissions.manage');

        if ($permissionModule->permissions()->exists()) {
            return back()->withErrors(['module' => 'A module containing permissions cannot be deleted.']);
        }

        $before = $permissionModule->toArray();
        $this->auditLogger->record($request->user(), 'permission_module.deleted', $permissionModule, $before);
        $permissionModule->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Permission module deleted.']);

        return back();
    }

    public function storePermission(StorePermissionRequest $request): RedirectResponse
    {
        $permission = Permission::query()->create($request->validated());
        $this->auditLogger->record($request->user(), 'permission.created', $permission, null, $permission->toArray());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Permission created.']);

        return back();
    }

    public function updatePermission(UpdatePermissionRequest $request, Permission $permission): RedirectResponse
    {
        $this->ensurePermissionCanBeChanged($request, $permission);
        $before = $permission->toArray();
        $permission->update($request->validated());
        $this->auditLogger->record($request->user(), 'permission.updated', $permission, $before, $permission->fresh()->toArray());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Permission updated.']);

        return back();
    }

    public function destroyPermission(Request $request, Permission $permission): RedirectResponse
    {
        Gate::authorize('permissions.manage');
        $this->ensurePermissionCanBeChanged($request, $permission);

        if ($permission->roles()->exists()) {
            return back()->withErrors(['permission' => 'An assigned permission cannot be deleted. Remove it from every role first.']);
        }

        $before = $permission->toArray();
        $this->auditLogger->record($request->user(), 'permission.deleted', $permission, $before);
        $permission->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Permission deleted.']);

        return back();
    }

    private function ensurePermissionCanBeChanged(Request $request, Permission $permission): void
    {
        if (! $request->user()->hasPermissionTo('roles.grant-any') && $request->user()->hasPermissionTo($permission->slug)) {
            throw new AuthorizationException('You cannot change a permission inherited by your own account.');
        }
    }
}
