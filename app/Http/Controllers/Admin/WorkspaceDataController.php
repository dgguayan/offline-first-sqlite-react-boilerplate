<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Task;
use App\Services\AuditLogger;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceDataController extends Controller
{
    public function __construct(private AuditLogger $auditLogger) {}

    public function __invoke(Request $request): Response
    {
        Gate::authorize('workspace.view-all');

        $type = $request->string('type')->toString() === 'projects'
            ? 'projects'
            : 'tasks';
        $status = in_array($request->string('status')->toString(), ['active', 'completed', 'incomplete', 'archived'], true)
            ? $request->string('status')->toString()
            : '';
        $sort = in_array($request->string('sort')->toString(), ['title', 'owner', 'completed', 'created_at', 'updated_at'], true)
            ? $request->string('sort')->toString()
            : 'updated_at';
        $direction = $request->string('direction')->toString() === 'asc' ? 'asc' : 'desc';
        $search = trim($request->string('search')->toString());
        $sortColumn = $sort === 'owner' ? 'users.name' : "{$type}.{$sort}";

        $records = DB::table($type)
            ->join('users', "{$type}.user_id", '=', 'users.id')
            ->select([
                "{$type}.id",
                "{$type}.user_id",
                "{$type}.title",
                "{$type}.completed",
                "{$type}.version",
                "{$type}.deleted_at as archived_at",
                "{$type}.created_at",
                "{$type}.updated_at",
                'users.name as owner_name',
                'users.email as owner_email',
            ])
            ->when($search !== '', function (Builder $query) use ($search, $type): void {
                $term = "%{$search}%";
                $query->where(function (Builder $query) use ($term, $type): void {
                    $query->where("{$type}.title", 'like', $term)
                        ->orWhere('users.name', 'like', $term)
                        ->orWhere('users.email', 'like', $term);
                });
            })
            ->when($status === 'active', fn (Builder $query) => $query->whereNull("{$type}.deleted_at"))
            ->when($status === 'completed', fn (Builder $query) => $query->whereNull("{$type}.deleted_at")->where("{$type}.completed", true))
            ->when($status === 'incomplete', fn (Builder $query) => $query->whereNull("{$type}.deleted_at")->where("{$type}.completed", false))
            ->when($status === 'archived', fn (Builder $query) => $query->whereNotNull("{$type}.deleted_at"))
            ->orderBy($sortColumn, $direction)
            ->orderBy("{$type}.id")
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('admin/workspace-data/index', [
            'records' => $records,
            'counts' => [
                'tasks' => DB::table('tasks')->count(),
                'projects' => DB::table('projects')->count(),
            ],
            'filters' => [
                'type' => $type,
                'search' => $search,
                'status' => $status,
                'sort' => $sort,
                'direction' => $direction,
            ],
        ]);
    }

    public function archive(Request $request, string $type, string $id): RedirectResponse
    {
        Gate::authorize('workspace.archive-any');

        $record = $this->findWorkspaceRecord($type, $id);

        if ($record->deleted_at !== null) {
            return back()->withErrors(['record' => 'This workspace record is already archived.']);
        }

        return $this->changeArchiveState($request, $record, $type, true);
    }

    public function restore(Request $request, string $type, string $id): RedirectResponse
    {
        Gate::authorize('workspace.restore-any');

        $record = $this->findWorkspaceRecord($type, $id);

        if ($record->deleted_at === null) {
            return back()->withErrors(['record' => 'This workspace record is not archived.']);
        }

        return $this->changeArchiveState($request, $record, $type, false);
    }

    private function findWorkspaceRecord(string $type, string $id): Task|Project
    {
        abort_unless(in_array($type, ['tasks', 'projects'], true), 404);

        return $type === 'tasks'
            ? Task::query()->findOrFail($id)
            : Project::query()->findOrFail($id);
    }

    private function changeArchiveState(
        Request $request,
        Task|Project $record,
        string $type,
        bool $archive,
    ): RedirectResponse {
        $entityType = $type === 'tasks' ? 'task' : 'project';
        $action = $archive ? 'archived' : 'restored';
        $before = $this->auditableValues($record);

        DB::transaction(function () use ($request, $record, $entityType, $action, $archive, $before): void {
            $record->deleted_at = $archive ? now() : null;
            $record->save();

            $this->auditLogger->record(
                $request->user(),
                "workspace.{$entityType}.{$action}",
                $record,
                $before,
                $this->auditableValues($record),
                [
                    'entity_type' => $entityType,
                    'owner_user_id' => $record->user_id,
                ],
            );
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => ucfirst($entityType).' '.$action.'.']);

        return back();
    }

    /**
     * @return array{id: string, user_id: int, title: string, completed: bool, version: int, archived_at: string|null}
     */
    private function auditableValues(Task|Project $record): array
    {
        return [
            'id' => $record->id,
            'user_id' => $record->user_id,
            'title' => $record->title,
            'completed' => $record->completed,
            'version' => $record->version,
            'archived_at' => $record->deleted_at?->toISOString(),
        ];
    }
}
