<?php

namespace App\Services\Sync;

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

            $task = Task::query()->lockForUpdate()->find($entityId);

            if ($task && $task->user_id !== $user->id) {
                return $this->rememberResult(
                    $user,
                    $deviceId,
                    $mutation,
                    $this->rejectedResult(
                        $mutationId,
                        'This task identifier is unavailable.',
                    ),
                );
            }

            if ($operation === 'create') {
                if ($task) {
                    return $this->rememberResult(
                        $user,
                        $deviceId,
                        $mutation,
                        $this->conflictResult($mutationId, $task),
                    );
                }

                $task = Task::query()->create([
                    'id' => $entityId,
                    'user_id' => $user->id,
                    'title' => (string) $data['title'],
                    'completed' => (bool) $data['completed'],
                    'version' => 1,
                    'deleted_at' => null,
                ]);

                return $this->rememberResult(
                    $user,
                    $deviceId,
                    $mutation,
                    $this->acceptedResult($mutationId, $task),
                );
            }

            if (! $task) {
                return $this->rememberResult(
                    $user,
                    $deviceId,
                    $mutation,
                    $this->rejectedResult(
                        $mutationId,
                        'The task does not exist on the server.',
                    ),
                );
            }

            if ($task->version !== $baseVersion) {
                return $this->rememberResult(
                    $user,
                    $deviceId,
                    $mutation,
                    $this->conflictResult($mutationId, $task),
                );
            }

            if ($operation === 'delete') {
                $task->deleted_at = now();
            } else {
                $task->title = (string) $data['title'];
                $task->completed = (bool) $data['completed'];
                $task->deleted_at = null;
            }

            $task->save();

            return $this->rememberResult(
                $user,
                $deviceId,
                $mutation,
                $this->acceptedResult($mutationId, $task),
            );
        }, 3);
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
    private function acceptedResult(string $mutationId, Task $task): array
    {
        return [
            'status' => 'accepted',
            'mutation_id' => $mutationId,
            'record' => $task->syncRecord(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function conflictResult(string $mutationId, Task $task): array
    {
        return [
            'status' => 'conflicts',
            'mutation_id' => $mutationId,
            'message' => 'The task changed on the server.',
            'server_version' => $task->version,
            'server_record' => $task->syncRecord(),
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
