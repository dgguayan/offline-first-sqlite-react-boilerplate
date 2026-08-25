<?php

namespace App\Services\Sync;

use App\Models\SyncChange;
use App\Models\User;

class PullSyncService
{
    /**
     * @return array{changes: list<array<string, mixed>>, next_cursor: int, has_more: bool}
     */
    public function pull(User $user, int $cursor, int $limit): array
    {
        $changes = SyncChange::query()
            ->where('user_id', $user->id)
            ->where('cursor', '>', $cursor)
            ->orderBy('cursor')
            ->limit($limit + 1)
            ->get();
        $hasMore = $changes->count() > $limit;
        $page = $changes->take($limit)->values();

        return [
            'changes' => $page->map(fn (SyncChange $change): array => [
                'cursor' => $change->cursor,
                'entity_type' => $change->entity_type,
                'entity_id' => $change->entity_id,
                'operation' => $change->operation,
                'version' => $change->version,
                'record' => $change->record,
            ])->all(),
            'next_cursor' => (int) ($page->last()?->cursor ?? $cursor),
            'has_more' => $hasMore,
        ];
    }
}
