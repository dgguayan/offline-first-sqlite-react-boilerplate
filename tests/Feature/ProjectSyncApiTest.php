<?php

use App\Models\Project;
use App\Models\SyncChange;
use App\Models\SyncMutation;
use App\Models\User;
use Illuminate\Support\Str;

test('the projects page requires a verified user', function () {
    $this->get(route('projects'))->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create())
        ->get(route('projects'))
        ->assertOk();
});

test('a project create is accepted and replaying it is idempotent', function () {
    $user = User::factory()->create();
    $projectId = (string) Str::uuid();
    $mutation = projectSyncMutation($projectId, 'create');
    $payload = projectSyncPayload([$mutation]);

    $this->actingAs($user)
        ->postJson('/api/sync/push', $payload)
        ->assertOk()
        ->assertJsonCount(1, 'accepted')
        ->assertJsonPath('accepted.0.mutation_id', $mutation['id'])
        ->assertJsonPath('accepted.0.record.version', 1);

    $this->actingAs($user)
        ->postJson('/api/sync/push', $payload)
        ->assertOk()
        ->assertJsonPath('accepted.0.record.version', 1);

    expect(Project::query()->whereKey($projectId)->count())->toBe(1)
        ->and(SyncMutation::query()->where('entity_type', 'project')->count())->toBe(1)
        ->and(SyncChange::query()->where('entity_type', 'project')->count())->toBe(1);
});

test('a project can be updated, pulled, and deleted', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create([
        'title' => 'Original project',
        'completed' => false,
    ]);

    $this->actingAs($user)
        ->postJson('/api/sync/push', projectSyncPayload([
            projectSyncMutation(
                $project->id,
                'update',
                1,
                'Updated project',
                true,
            ),
        ]))
        ->assertOk()
        ->assertJsonPath('accepted.0.record.title', 'Updated project')
        ->assertJsonPath('accepted.0.record.completed', true)
        ->assertJsonPath('accepted.0.record.version', 2);

    $this->actingAs($user)
        ->getJson('/api/sync/pull?cursor=0&limit=100')
        ->assertOk()
        ->assertJsonPath('changes.0.entity_type', 'project');

    $this->actingAs($user)
        ->postJson('/api/sync/push', projectSyncPayload([
            projectSyncMutation($project->id, 'delete', 2),
        ]))
        ->assertOk()
        ->assertJsonPath('accepted.0.record.version', 3);

    expect($project->fresh())
        ->title->toBe('Updated project')
        ->completed->toBeTrue()
        ->version->toBe(3)
        ->deleted_at->not->toBeNull();
});

test('a user cannot mutate another users project', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $project = Project::factory()->for($owner)->create([
        'title' => 'Owners project',
    ]);

    $this->actingAs($otherUser)
        ->postJson('/api/sync/push', projectSyncPayload([
            projectSyncMutation($project->id, 'update', 1, 'Stolen project'),
        ]))
        ->assertOk()
        ->assertJsonCount(0, 'accepted')
        ->assertJsonPath('rejected.0.retryable', false);

    expect($project->fresh()->title)->toBe('Owners project');
});

/**
 * @param  list<array<string, mixed>>  $mutations
 * @return array{device_id: string, mutations: list<array<string, mixed>>}
 */
function projectSyncPayload(array $mutations): array
{
    return [
        'device_id' => (string) Str::uuid(),
        'mutations' => $mutations,
    ];
}

/**
 * @return array<string, mixed>
 */
function projectSyncMutation(
    string $projectId,
    string $operation,
    ?int $baseVersion = null,
    string $title = 'Offline project',
    bool $completed = false,
): array {
    $now = now()->toISOString();

    return [
        'id' => (string) Str::uuid(),
        'entity_type' => 'project',
        'entity_id' => $projectId,
        'operation' => $operation,
        'base_version' => $baseVersion,
        'data' => [
            'id' => $projectId,
            'title' => $title,
            'completed' => $completed,
            'created_at' => $now,
            'updated_at' => $now,
            'deleted_at' => $operation === 'delete' ? $now : null,
        ],
    ];
}
