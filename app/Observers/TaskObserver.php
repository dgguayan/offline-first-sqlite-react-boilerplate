<?php

namespace App\Observers;

use App\Models\SyncChange;
use App\Models\Task;

class TaskObserver
{
    /**
     * Handle the Task "created" event.
     */
    public function created(Task $task): void
    {
        $this->recordChange($task);
    }

    /**
     * Handle the Task "updated" event.
     */
    public function updated(Task $task): void
    {
        $this->recordChange($task);
    }

    /**
     * Handle the Task "deleted" event.
     */
    private function recordChange(Task $task): void
    {
        SyncChange::query()->create([
            'user_id' => $task->user_id,
            'entity_type' => 'task',
            'entity_id' => $task->id,
            'operation' => $task->deleted_at ? 'delete' : 'upsert',
            'version' => $task->version,
            'record' => $task->syncRecord(),
        ]);
    }
}
