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
            'operation' => $this->operation($task),
            'version' => $task->version,
            'record' => $task->syncRecord(),
        ]);
    }

    private function operation(Task $task): string
    {
        if ($task->deleted_at !== null) {
            return 'delete';
        }

        return $task->wasChanged('deleted_at') && $task->getOriginal('deleted_at') !== null
            ? 'restore'
            : 'upsert';
    }
}
