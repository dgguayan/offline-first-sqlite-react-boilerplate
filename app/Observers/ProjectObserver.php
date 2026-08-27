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
            'operation' => $this->operation($project),
            'version' => $project->version,
            'record' => $project->syncRecord(),
        ]);
    }

    private function operation(Project $project): string
    {
        if ($project->deleted_at !== null) {
            return 'delete';
        }

        return $project->wasChanged('deleted_at') && $project->getOriginal('deleted_at') !== null
            ? 'restore'
            : 'upsert';
    }
}
