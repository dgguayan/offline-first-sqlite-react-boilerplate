<?php

namespace App\Services\Sync;

use App\Models\Project;
use App\Models\SyncMutation;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PushSyncService
{
    /**
     * @param  list<array<string, mixed>>  $mutations
     * @return array{
     *     accepted: list<array<string, mixed>>,
     *     conflicts: list<array<string, mixed>>,
     *     rejected: list<array<string, mixed>>
     * }
     */
    public function push(User $user, string $deviceId, array $mutations): array
    {
        $response = [
            'accepted' => [],
            'conflicts' => [],
            'rejected' => [],
        ];

        foreach ($mutations as $mutation) {
            $result = $this->processMutation($user, $deviceId, $mutation);
            $status = (string) $result['status'];
            unset($result['status']);

            $response[$status][] = $result;
        }

        return $response;
    }

    /**
     * @param  array<string, mixed>  $mutation
     * @return array<string, mixed>
     */
    private function processMutation(
        User $user,
        string $deviceId,
        array $mutation,
    ): array {
        return DB::transaction(function () use ($user, $deviceId, $mutation): array {
            $mutationId = (string) $mutation['id'];
            $existingMutation = SyncMutation::query()
                ->lockForUpdate()
                ->find($mutationId);

            if ($existingMutation) {
                if ($existingMutation->user_id !== $user->id) {
                    return $this->rejectedResult(
                        $mutationId,
                        'This mutation identifier is unavailable.',
                    );
                }

                return $existingMutation->result;
            }

            $entityId = (string) $mutation['entity_id'];
            $entityType = (string) $mutation['entity_type'];
            /** @var array<string, mixed> $data */
            $data = $mutation['data'];
            $operation = (string) $mutation['operation'];
            $baseVersion = isset($mutation['base_version'])
                ? (int) $mutation['base_version']
                : null;

            if ($entityId !== (string) $data['id']) {
                return $this->rememberResult(
                    $user,
                    $deviceId,
                    $mutation,
                    $this->rejectedResult(
                        $mutationId,
                        'The entity and payload identifiers must match.',
                    ),
                );
            }

            if ($operation !== 'create' && $baseVersion === null) {
                return $this->rememberResult(
                    $user,
                    $deviceId,
                    $mutation,
                    $this->rejectedResult(
                        $mutationId,
                        'A base version is required for updates and deletes.',
                    ),
                );
            }

            $entity = $this->findEntity($entityType, $entityId);

            if ($entity && $entity->user_id !== $user->id) {
                return $this->rememberResult(
                    $user,
                    $deviceId,
                    $mutation,
                    $this->rejectedResult(
                        $mutationId,
                        "This {$entityType} identifier is unavailable.",
                    ),
                );
            }

            if ($operation === 'create') {
                if ($entity) {
                    return $this->rememberResult(
                        $user,
                        $deviceId,
                        $mutation,
                        $this->conflictResult($mutationId, $entityType, $entity),
                    );
                }

                $entity = $this->createEntity(
                    $entityType,
                    $user,
                    $entityId,
                    $data,
                );

                return $this->rememberResult(
                    $user,
                    $deviceId,
                    $mutation,
                    $this->acceptedResult($mutationId, $entity),
                );
            }

            if (! $entity) {
                return $this->rememberResult(
                    $user,
                    $deviceId,
                    $mutation,
                    $this->rejectedResult(
                        $mutationId,
                        "The {$entityType} does not exist on the server.",
                    ),
                );
            }

            if ($entity->version !== $baseVersion) {
                return $this->rememberResult(
                    $user,
                    $deviceId,
                    $mutation,
                    $this->conflictResult($mutationId, $entityType, $entity),
                );
            }

            if ($operation === 'delete') {
                $entity->deleted_at = now();
            } else {
                $entity->title = (string) $data['title'];
                $entity->completed = (bool) $data['completed'];
                $entity->deleted_at = null;
            }

            $entity->save();

            return $this->rememberResult(
                $user,
                $deviceId,
                $mutation,
                $this->acceptedResult($mutationId, $entity),
            );
        }, 3);
    }

    private function findEntity(string $entityType, string $entityId): Task|Project|null
    {
        return match ($entityType) {
            'task' => Task::query()->lockForUpdate()->find($entityId),
            'project' => Project::query()->lockForUpdate()->find($entityId),
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function createEntity(
        string $entityType,
        User $user,
        string $entityId,
        array $data,
    ): Task|Project {
        $attributes = [
            'id' => $entityId,
            'user_id' => $user->id,
            'title' => (string) $data['title'],
            'completed' => (bool) $data['completed'],
            'version' => 1,
            'deleted_at' => null,
        ];

        return match ($entityType) {
            'task' => Task::query()->create($attributes),
            'project' => Project::query()->create($attributes),
        };
    }

    /**
     * @param  array<string, mixed>  $mutation
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function rememberResult(
        User $user,
        string $deviceId,
        array $mutation,
        array $result,
    ): array {
        SyncMutation::query()->create([
            'id' => $mutation['id'],
            'user_id' => $user->id,
            'device_id' => $deviceId,
            'entity_type' => $mutation['entity_type'],
            'entity_id' => $mutation['entity_id'],
            'operation' => $mutation['operation'],
            'result' => $result,
            'processed_at' => now(),
        ]);

        return $result;
    }

    /**
     * @return array<string, mixed>
     */
    private function acceptedResult(string $mutationId, Task|Project $entity): array
    {
        return [
            'status' => 'accepted',
            'mutation_id' => $mutationId,
            'record' => $entity->syncRecord(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function conflictResult(
        string $mutationId,
        string $entityType,
        Task|Project $entity,
    ): array {
        return [
            'status' => 'conflicts',
            'mutation_id' => $mutationId,
            'message' => "The {$entityType} changed on the server.",
            'server_version' => $entity->version,
            'server_record' => $entity->syncRecord(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function rejectedResult(string $mutationId, string $message): array
    {
        return [
            'status' => 'rejected',
            'mutation_id' => $mutationId,
            'message' => $message,
            'retryable' => false,
        ];
    }
}
