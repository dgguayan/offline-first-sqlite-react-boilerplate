<?php

use App\Models\SyncChange;
use App\Models\SyncMutation;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Str;

test('sync endpoints require authentication', function () {
    $this->getJson('/api/sync/health')->assertUnauthorized();
    $this->getJson('/api/sync/pull')->assertUnauthorized();
    $this->postJson('/api/sync/push', [])->assertUnauthorized();
});

test('a task create is accepted and replaying the mutation is idempotent', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();
    $mutation = syncMutation($taskId, 'create');
    $payload = syncPayload([$mutation]);

    $firstResponse = $this->actingAs($user)->postJson('/api/sync/push', $payload);

    $firstResponse
        ->assertOk()
        ->assertJsonCount(1, 'accepted')
        ->assertJsonCount(0, 'conflicts')
        ->assertJsonCount(0, 'rejected')
        ->assertJsonPath('accepted.0.mutation_id', $mutation['id'])
        ->assertJsonPath('accepted.0.record.version', 1);

    $this->actingAs($user)
        ->postJson('/api/sync/push', $payload)
        ->assertOk()
        ->assertJsonPath('accepted.0.record.version', 1);

    expect(Task::query()->whereKey($taskId)->count())->toBe(1)
        ->and(SyncMutation::query()->count())->toBe(1)
        ->and(SyncChange::query()->count())->toBe(1);
});

test('stale updates conflict and preserve the winning server value', function () {
    $user = User::factory()->create();
    $task = Task::factory()->for($user)->create([
        'title' => 'Original',
        'completed' => false,
    ]);

    $winner = syncMutation($task->id, 'update', 1, 'First device');
    $loser = syncMutation($task->id, 'update', 1, 'Second device');

    $this->actingAs($user)
        ->postJson('/api/sync/push', syncPayload([$winner]))
        ->assertOk()
        ->assertJsonPath('accepted.0.record.version', 2);

    $this->actingAs($user)
        ->postJson('/api/sync/push', syncPayload([$loser]))
        ->assertOk()
        ->assertJsonCount(0, 'accepted')
        ->assertJsonPath('conflicts.0.server_version', 2)
        ->assertJsonPath('conflicts.0.server_record.title', 'First device');

    expect($task->fresh())
        ->title->toBe('First device')
        ->version->toBe(2);
});

test('delete creates a versioned tombstone', function () {
    $user = User::factory()->create();
    $task = Task::factory()->for($user)->create();
    $mutation = syncMutation($task->id, 'delete', 1);

    $this->actingAs($user)
        ->postJson('/api/sync/push', syncPayload([$mutation]))
        ->assertOk()
        ->assertJsonPath('accepted.0.record.version', 2)
        ->assertJsonPath('accepted.0.record.id', $task->id);

    expect($task->fresh()->deleted_at)->not->toBeNull()
        ->and(SyncChange::query()->latest('cursor')->value('operation'))
        ->toBe('delete');
});

test('pull is cursor paginated and isolated to the authenticated user', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    Task::factory()->for($user)->count(2)->create();
    Task::factory()->for($otherUser)->create();

    $firstPage = $this->actingAs($user)->getJson('/api/sync/pull?cursor=0&limit=1');
    $firstPage
        ->assertOk()
        ->assertJsonCount(1, 'changes')
        ->assertJsonPath('has_more', true);
    $cursor = $firstPage->json('next_cursor');

    $secondPage = $this->actingAs($user)->getJson("/api/sync/pull?cursor={$cursor}&limit=10");
    $secondPage
        ->assertOk()
        ->assertJsonCount(1, 'changes')
        ->assertJsonPath('has_more', false);

    $returnedEntityIds = [
        $firstPage->json('changes.0.entity_id'),
        $secondPage->json('changes.0.entity_id'),
    ];

    expect(Task::query()->where('user_id', $user->id)->pluck('id')->all())
        ->each->toBeIn($returnedEntityIds)
        ->and($returnedEntityIds)
        ->not->toContain(Task::query()->where('user_id', $otherUser->id)->value('id'));
});

test('push validates bounded mutation payloads', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/sync/push', [
            'device_id' => 'not-a-uuid',
            'mutations' => [['operation' => 'overwrite']],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'device_id',
            'mutations.0.id',
            'mutations.0.entity_type',
            'mutations.0.entity_id',
            'mutations.0.operation',
            'mutations.0.data',
        ]);
});

/**
 * @param  list<array<string, mixed>>  $mutations
 * @return array{device_id: string, mutations: list<array<string, mixed>>}
 */
function syncPayload(array $mutations): array
{
    return [
        'device_id' => (string) Str::uuid(),
        'mutations' => $mutations,
    ];
}

/**
 * @return array<string, mixed>
 */
function syncMutation(
    string $taskId,
    string $operation,
    ?int $baseVersion = null,
    string $title = 'Offline task',
): array {
    $now = now()->toISOString();

    return [
        'id' => (string) Str::uuid(),
        'entity_type' => 'task',
        'entity_id' => $taskId,
        'operation' => $operation,
        'base_version' => $baseVersion,
        'data' => [
            'id' => $taskId,
            'title' => $title,
            'completed' => false,
            'created_at' => $now,
            'updated_at' => $now,
            'deleted_at' => $operation === 'delete' ? $now : null,
        ],
    ];
}
