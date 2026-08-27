<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Http\Requests\Admin\UpdateUserRolesRequest;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Password;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function __construct(private AuditLogger $auditLogger) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', User::class);
        $actor = $request->user();
        $sort = in_array($request->string('sort')->toString(), ['name', 'email', 'username', 'status', 'created_at', 'last_login_at', 'updated_at'], true)
            ? $request->string('sort')->toString()
            : 'created_at';
        $direction = $request->string('direction')->toString() === 'asc' ? 'asc' : 'desc';

        $users = User::query()
            ->with('roles:id,name,slug')
            ->when($actor->permissionScope('users.view') === 'department', fn (Builder $query) => $query->where('department', $actor->department))
            ->when($actor->permissionScope('users.view') === 'own', fn (Builder $query) => $query->whereKey($actor->id))
            ->when($request->filled('search'), function (Builder $query) use ($request): void {
                $search = '%'.$request->string('search')->toString().'%';
                $query->where(function (Builder $query) use ($search): void {
                    $query->where('name', 'like', $search)
                        ->orWhere('email', 'like', $search)
                        ->orWhere('username', 'like', $search)
                        ->orWhere('department', 'like', $search);
                });
            })
            ->when($request->filled('status'), fn (Builder $query) => $query->where('status', $request->string('status')->toString()))
            ->when($request->filled('role'), fn (Builder $query) => $query->whereHas('roles', fn (Builder $query) => $query->where('roles.id', $request->integer('role'))))
            ->orderBy($sort, $direction)
            ->paginate(15)
            ->withQueryString()
            ->through(fn (User $user): array => $this->userData($user, $actor));

        return Inertia::render('admin/users/index', [
            'users' => $users,
            'roles' => Role::query()->orderBy('name')->get(['id', 'name']),
            'filters' => $request->only(['search', 'status', 'role', 'sort', 'direction']),
        ]);
    }

    public function create(): Response
    {
        Gate::authorize('create', User::class);

        return Inertia::render('admin/users/create');
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['deactivated_at'] = $data['status'] === 'inactive' ? now() : null;

        $user = DB::transaction(function () use ($request, $data): User {
            $user = User::query()->create($data);
            $defaultRole = Role::query()->where('is_default', true)->where('is_active', true)->first();
            $defaultRole?->users()->attach($user->id, ['assigned_by' => $request->user()->id]);
            $this->auditLogger->record($request->user(), 'user.created', $user, null, $this->auditableUserValues($user));

            return $user;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'User created.']);

        return to_route('admin.users.show', $user);
    }

    public function show(Request $request, User $user): Response
    {
        Gate::authorize('view', $user);
        $user->load(['roles.permissions']);

        return Inertia::render('admin/users/show', [
            'managedUser' => $this->userData($user, $request->user(), true),
            'availableRoles' => Role::query()->where('is_active', true)->withCount('permissions')->orderBy('name')->get(['id', 'name', 'description']),
            'permissionSources' => $this->permissionSources($user),
        ]);
    }

    public function edit(User $user): RedirectResponse
    {
        Gate::authorize('update', $user);

        return to_route('admin.users.show', $user);
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $before = $this->auditableUserValues($user);
        $user->fill($request->validated());

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();
        $this->auditLogger->record($request->user(), 'user.updated', $user, $before, $this->auditableUserValues($user));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'User details updated.']);

        return to_route('admin.users.show', $user);
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        Gate::authorize('delete', $user);
        $before = $this->auditableUserValues($user);

        DB::transaction(function () use ($request, $user, $before): void {
            $this->auditLogger->record($request->user(), 'user.deleted', $user, $before);
            $user->delete();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'User deleted.']);

        return to_route('admin.users.index');
    }

    public function activate(Request $request, User $user): RedirectResponse
    {
        Gate::authorize('deactivate', $user);
        $before = ['status' => $user->status, 'deactivated_at' => $user->deactivated_at?->toISOString()];
        $user->update(['status' => 'active', 'deactivated_at' => null]);
        $this->auditLogger->record($request->user(), 'user.activated', $user, $before, ['status' => 'active', 'deactivated_at' => null]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'User activated.']);

        return back();
    }

    public function deactivate(Request $request, User $user): RedirectResponse
    {
        Gate::authorize('deactivate', $user);
        $before = ['status' => $user->status, 'deactivated_at' => $user->deactivated_at?->toISOString()];

        DB::transaction(function () use ($request, $user, $before): void {
            $user->update(['status' => 'inactive', 'deactivated_at' => now()]);
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $this->auditLogger->record($request->user(), 'user.deactivated', $user, $before, ['status' => 'inactive', 'deactivated_at' => $user->deactivated_at?->toISOString()]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'User deactivated and active sessions revoked.']);

        return back();
    }

    public function updateRoles(UpdateUserRolesRequest $request, User $user): RedirectResponse
    {
        $actor = $request->user();
        $assignments = collect($request->assignments());
        $roles = Role::query()->whereIn('id', $assignments->pluck('role_id'))->with('permissions')->get()->keyBy('id');

        foreach ($assignments as $assignment) {
            $role = $roles->get($assignment['role_id']);

            if ($role === null || ! $role->is_active) {
                throw new AuthorizationException('Only active roles may be assigned.');
            }

            $this->ensureRoleCanBeAssigned($actor, $role);
        }

        DB::transaction(function () use ($actor, $assignments, $user): void {
            $oldValues = $user->roles()->get()->mapWithKeys(fn (Role $role): array => [$role->slug => $role->assignmentExpiresAt()?->toISOString()])->all();
            $syncData = $assignments->mapWithKeys(fn (array $assignment): array => [
                $assignment['role_id'] => ['assigned_by' => $actor->id, 'expires_at' => $assignment['expires_at'] ?? null],
            ]);
            $user->roles()->sync($syncData);
            $user->clearPermissionCache();
            $newValues = $user->roles()->get()->mapWithKeys(fn (Role $role): array => [$role->slug => $role->assignmentExpiresAt()?->toISOString()])->all();
            $this->auditLogger->record($actor, 'user.roles_updated', $user, $oldValues, $newValues);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Role assignments updated.']);

        return back();
    }

    public function sendPasswordReset(Request $request, User $user): RedirectResponse
    {
        Gate::authorize('resetPassword', $user);
        $status = Password::sendResetLink(['email' => $user->email]);

        if ($status !== Password::RESET_LINK_SENT) {
            return back()->withErrors(['password_reset' => __($status)]);
        }

        $this->auditLogger->record($request->user(), 'user.password_reset_requested', $user, metadata: ['delivery' => 'email']);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Password reset email sent.']);

        return back();
    }

    /** @return array<string, mixed> */
    private function userData(User $user, User $actor, bool $includeProfile = false): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'email_verified_at' => $user->email_verified_at?->toISOString(),
            'status' => $user->status,
            'job_title' => $user->job_title,
            'department' => $user->department,
            'phone' => $includeProfile ? $user->phone : null,
            'bio' => $includeProfile ? $user->bio : null,
            'last_login_at' => $user->last_login_at?->toISOString(),
            'deactivated_at' => $user->deactivated_at?->toISOString(),
            'created_at' => $user->created_at?->toISOString(),
            'updated_at' => $user->updated_at?->toISOString(),
            'roles' => $user->roles->map(fn (Role $role): array => ['id' => $role->id, 'name' => $role->name, 'slug' => $role->slug, 'expires_at' => $role->assignmentExpiresAt()?->toISOString()])->values(),
            'can' => [
                'view' => $actor->can('view', $user),
                'update' => $actor->can('update', $user),
                'delete' => $actor->can('delete', $user),
                'deactivate' => $actor->can('deactivate', $user),
                'reset_password' => $actor->can('resetPassword', $user),
                'assign_roles' => $actor->can('assignRoles', $user),
            ],
        ];
    }

    /** @return list<array{role: string, permission: string, scope: string}> */
    private function permissionSources(User $user): array
    {
        return array_values($user->roles
            ->filter(fn (Role $role): bool => $role->is_active && ($role->assignmentExpiresAt() === null || now()->lt($role->assignmentExpiresAt())))
            ->flatMap(fn (Role $role) => $role->permissions->map(fn (Permission $permission): array => ['role' => $role->name, 'permission' => $permission->slug, 'scope' => $permission->assignedScope()]))
            ->sortBy(['permission', 'role'])
            ->values()
            ->all());
    }

    private function ensureRoleCanBeAssigned(User $actor, Role $role): void
    {
        if ($actor->hasPermissionTo('roles.grant-any')) {
            return;
        }

        $scopeRanks = ['own' => 1, 'department' => 2, 'all' => 3];

        foreach ($role->permissions as $permission) {
            if (($scopeRanks[$permission->assignedScope()] ?? 0) > ($scopeRanks[$actor->permissionScope($permission->slug)] ?? 0)) {
                throw new AuthorizationException('You cannot assign a role containing permissions or scopes you do not have.');
            }
        }
    }

    /** @return array<string, mixed> */
    private function auditableUserValues(User $user): array
    {
        return $user->only(['name', 'username', 'email', 'status', 'job_title', 'department', 'phone', 'bio']);
    }
}
