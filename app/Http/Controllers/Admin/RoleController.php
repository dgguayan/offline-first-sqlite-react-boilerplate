<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreRoleRequest;
use App\Http\Requests\Admin\UpdateRoleRequest;
use App\Models\PermissionModule;
use App\Models\Role;
use App\Services\AuditLogger;
use App\Services\RolePermissionService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class RoleController extends Controller
{
    public function __construct(
        private AuditLogger $auditLogger,
        private RolePermissionService $rolePermissionService,
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('roles.view');
        $roles = Role::query()
            ->withCount(['users', 'permissions'])
            ->when($request->filled('search'), function (Builder $query) use ($request): void {
                $search = '%'.$request->string('search')->toString().'%';
                $query->where(fn (Builder $query) => $query->where('name', 'like', $search)->orWhere('slug', 'like', $search));
            })
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('admin/roles/index', [
            'roles' => $roles,
            'filters' => $request->only('search'),
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('roles.create');

        return Inertia::render('admin/roles/form', [
            'managedRole' => null,
            'modules' => $this->permissionMatrix(),
            'canManagePermissions' => $request->user()->hasPermissionTo('roles.manage-permissions'),
        ]);
    }

    public function store(StoreRoleRequest $request): RedirectResponse
    {
        $data = $request->safe()->except('permissions');
        $grants = $request->validated('permissions', []);

        if ($grants !== [] && ! $request->user()->hasPermissionTo('roles.manage-permissions')) {
            throw new AuthorizationException('You are not allowed to configure role permissions.');
        }

        $role = DB::transaction(function () use ($request, $data, $grants): Role {
            if ($data['is_default']) {
                Role::query()->update(['is_default' => false]);
            }

            $role = Role::query()->create($data);
            $this->auditLogger->record($request->user(), 'role.created', $role, null, $role->only(['name', 'slug', 'description', 'is_active', 'is_default']));

            if ($request->user()->hasPermissionTo('roles.manage-permissions')) {
                $this->rolePermissionService->sync($role, $grants, $request->user());
            }

            return $role;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Role created.']);

        return to_route('admin.roles.edit', $role);
    }

    public function show(Role $role): RedirectResponse
    {
        Gate::authorize('roles.view');

        return to_route('admin.roles.edit', $role);
    }

    public function edit(Request $request, Role $role): Response
    {
        Gate::authorize('roles.edit');
        $role->load('permissions')->loadCount('users');

        return Inertia::render('admin/roles/form', [
            'managedRole' => [
                ...$role->only(['id', 'name', 'slug', 'description', 'is_active', 'is_default', 'users_count']),
                'permissions' => $role->permissions->map(fn ($permission): array => [
                    'permission_id' => $permission->id,
                    'scope' => $permission->assignedScope(),
                ])->values(),
            ],
            'modules' => $this->permissionMatrix(),
            'canManagePermissions' => $request->user()->hasPermissionTo('roles.manage-permissions'),
        ]);
    }

    public function update(UpdateRoleRequest $request, Role $role): RedirectResponse
    {
        $actor = $request->user();

        if (! $actor->hasPermissionTo('roles.grant-any') && $role->users()->whereKey($actor->id)->exists()) {
            throw new AuthorizationException('You cannot modify a role inherited by your own account.');
        }

        $before = $role->only(['name', 'slug', 'description', 'is_active', 'is_default']);
        $data = $request->safe()->except('permissions');

        DB::transaction(function () use ($request, $actor, $role, $before, $data): void {
            if ($data['is_default']) {
                Role::query()->whereKeyNot($role->id)->update(['is_default' => false]);
            }

            $role->update($data);
            $this->auditLogger->record($actor, 'role.updated', $role, $before, $role->only(['name', 'slug', 'description', 'is_active', 'is_default']));

            if ($request->has('permissions')) {
                Gate::authorize('roles.manage-permissions');
                $this->rolePermissionService->sync($role, $request->validated('permissions'), $actor);
            }
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Role updated.']);

        return back();
    }

    public function destroy(Request $request, Role $role): RedirectResponse
    {
        Gate::authorize('roles.delete');

        if ($role->is_default || $role->users()->exists()) {
            return back()->withErrors(['role' => 'Default or assigned roles cannot be deleted. Remove their assignments first.']);
        }

        $before = $role->only(['name', 'slug', 'description', 'is_active', 'is_default']);
        $this->auditLogger->record($request->user(), 'role.deleted', $role, $before);
        $role->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Role deleted.']);

        return to_route('admin.roles.index');
    }

    /** @return Collection<int, PermissionModule> */
    private function permissionMatrix()
    {
        return PermissionModule::query()
            ->with(['permissions' => fn ($query) => $query->orderBy('action')->orderBy('name')])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
    }
}
