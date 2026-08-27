<?php

use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Project;
use App\Models\Role;
use App\Models\SyncChange;
use App\Models\Task;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->administrator = User::factory()->create();
    $this->seed(RbacSeeder::class);
});

test('the administrator can view tasks belonging to every user', function () {
    $owner = User::factory()->create([
        'name' => 'Project Owner',
        'email' => 'owner@example.com',
    ]);
    Task::factory()->for($this->administrator)->create(['title' => 'Administrator task']);
    Task::factory()->for($owner)->create(['title' => 'Owner task']);

    $this->actingAs($this->administrator)
        ->get(route('admin.workspace-data.index', [
            'type' => 'tasks',
            'search' => 'owner@example.com',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/workspace-data/index')
            ->has('records.data', 1)
            ->where('counts.tasks', 2)
            ->where('records.data.0.owner_name', 'Project Owner')
            ->where('records.data.0.owner_email', 'owner@example.com'));
});

test('the administrator can search projects belonging to every user', function () {
    $owner = User::factory()->create([
        'name' => 'Finance Owner',
        'email' => 'finance@example.com',
    ]);
    Project::factory()->for($owner)->create(['title' => 'Quarterly migration']);
    Project::factory()->for($this->administrator)->create(['title' => 'Unrelated project']);

    $this->actingAs($this->administrator)
        ->get(route('admin.workspace-data.index', [
            'type' => 'projects',
            'search' => 'Finance Owner',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/workspace-data/index')
            ->has('records.data', 1)
            ->where('records.data.0.title', 'Quarterly migration')
            ->where('records.data.0.owner_email', 'finance@example.com'));
});

test('a user without the all workspace data permission is forbidden', function () {
    $user = User::factory()->create();
    $user->roles()->attach(Role::query()->where('is_default', true)->firstOrFail());

    $this->actingAs($user)
        ->get(route('admin.workspace-data.index'))
        ->assertForbidden();
});

test('the permission can be assigned dynamically to another role', function () {
    $user = User::factory()->create();
    $role = Role::factory()->create();
    $permission = Permission::query()->where('slug', 'workspace.view-all')->firstOrFail();
    $role->permissions()->attach($permission, ['scope' => 'all']);
    $user->roles()->attach($role);

    $this->actingAs($user)
        ->get(route('admin.workspace-data.index'))
        ->assertOk();
});

test('administrator receives archive and restore permissions instead of delete-any', function () {
    expect(Permission::query()->where('slug', 'workspace.delete-any')->exists())->toBeFalse()
        ->and($this->administrator->permissionScope('workspace.archive-any'))->toBe('all')
        ->and($this->administrator->permissionScope('workspace.restore-any'))->toBe('all');
});

test('the administrator can archive and restore another users task with sync and audit history', function () {
    $owner = User::factory()->create();
    $task = Task::factory()->for($owner)->create(['title' => 'Archive this task']);

    $this->actingAs($this->administrator)
        ->patch(route('admin.workspace-data.archive', ['type' => 'tasks', 'id' => $task->id]))
        ->assertRedirect();

    expect($task->fresh())
        ->deleted_at->not->toBeNull()
        ->version->toBe(2);

    $this->assertDatabaseHas('sync_changes', [
        'user_id' => $owner->id,
        'entity_type' => 'task',
        'entity_id' => $task->id,
        'operation' => 'delete',
        'version' => 2,
    ]);
    $this->assertDatabaseHas('audit_logs', [
        'actor_id' => $this->administrator->id,
        'event' => 'workspace.task.archived',
        'subject_type' => Task::class,
        'subject_id' => $task->id,
    ]);

    $auditLog = AuditLog::query()
        ->where('event', 'workspace.task.archived')
        ->where('subject_id', $task->id)
        ->firstOrFail();

    expect($auditLog)
        ->subject_id->toBe($task->id)
        ->metadata->toMatchArray([
            'entity_type' => 'task',
            'owner_user_id' => $owner->id,
        ]);

    $this->actingAs($this->administrator)
        ->get(route('admin.workspace-data.index', [
            'type' => 'tasks',
            'status' => 'archived',
            'search' => 'Archive this task',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('records.data', 1)
            ->where('records.data.0.id', $task->id)
            ->whereNot('records.data.0.archived_at', null));

    $this->actingAs($this->administrator)
        ->patch(route('admin.workspace-data.restore', ['type' => 'tasks', 'id' => $task->id]))
        ->assertRedirect();

    expect($task->fresh())
        ->deleted_at->toBeNull()
        ->version->toBe(3);
    expect(SyncChange::query()
        ->where('entity_type', 'task')
        ->where('entity_id', $task->id)
        ->latest('cursor')
        ->value('operation'))
        ->toBe('restore');
    $this->assertDatabaseHas('audit_logs', [
        'actor_id' => $this->administrator->id,
        'event' => 'workspace.task.restored',
        'subject_type' => Task::class,
        'subject_id' => $task->id,
    ]);
});

test('the administrator can archive and restore another users project', function () {
    $owner = User::factory()->create();
    $project = Project::factory()->for($owner)->create(['title' => 'Archive this project']);

    $this->actingAs($this->administrator)
        ->patch(route('admin.workspace-data.archive', ['type' => 'projects', 'id' => $project->id]))
        ->assertRedirect();

    expect($project->fresh())
        ->deleted_at->not->toBeNull()
        ->version->toBe(2);

    expect(SyncChange::query()
        ->where('entity_type', 'project')
        ->where('entity_id', $project->id)
        ->latest('cursor')
        ->value('operation'))
        ->toBe('delete');

    $this->actingAs($this->administrator)
        ->patch(route('admin.workspace-data.restore', ['type' => 'projects', 'id' => $project->id]))
        ->assertRedirect();

    expect($project->fresh())
        ->deleted_at->toBeNull()
        ->version->toBe(3);
    expect(SyncChange::query()
        ->where('entity_type', 'project')
        ->where('entity_id', $project->id)
        ->latest('cursor')
        ->value('operation'))
        ->toBe('restore');
});

test('view-all permission without archive-any permission cannot archive workspace data', function () {
    $user = User::factory()->create();
    $role = Role::factory()->create();
    $viewPermission = Permission::query()->where('slug', 'workspace.view-all')->firstOrFail();
    $role->permissions()->attach($viewPermission, ['scope' => 'all']);
    $user->roles()->attach($role);
    $task = Task::factory()->for(User::factory()->create())->create();

    $this->actingAs($user)
        ->patch(route('admin.workspace-data.archive', ['type' => 'tasks', 'id' => $task->id]))
        ->assertForbidden();

    expect($task->fresh()->deleted_at)->toBeNull();
});

test('archive-any permission without restore-any permission cannot restore workspace data', function () {
    $user = User::factory()->create();
    $role = Role::factory()->create();
    $permissions = Permission::query()
        ->whereIn('slug', ['workspace.view-all', 'workspace.archive-any'])
        ->get();
    $role->permissions()->attach($permissions->pluck('id')->all(), ['scope' => 'all']);
    $user->roles()->attach($role);
    $task = Task::factory()->for(User::factory()->create())->create([
        'deleted_at' => now(),
    ]);

    $this->actingAs($user)
        ->patch(route('admin.workspace-data.restore', ['type' => 'tasks', 'id' => $task->id]))
        ->assertForbidden();

    expect($task->fresh()->deleted_at)->not->toBeNull();
});
