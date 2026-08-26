<?php

namespace App\Observers;

use App\Models\Project;
use App\Models\SyncChange;

class ProjectObserver
{
    /**
     * Handle the Project "created" event.
     */
    public function created(Project $project): void
    {
        $this->recordChange($project);
    }

    /**
     * Handle the Project "updated" event.
     */
    public function updated(Project $project): void
    {
        $this->recordChange($project);
    }

    private function recordChange(Project $project): void
    {
        SyncChange::query()->create([
            'user_id' => $project->user_id,
            'entity_type' => 'project',
            'entity_id' => $project->id,
            'operation' => $project->deleted_at ? 'delete' : 'upsert',
            'version' => $project->version,
            'record' => $project->syncRecord(),
        ]);
    }
}
