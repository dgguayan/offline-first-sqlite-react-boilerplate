<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    public function __invoke(Request $request): Response
    {
        Gate::authorize('audit-logs.view');

        $logs = AuditLog::query()
            ->with('actor:id,name,email')
            ->when($request->filled('search'), function (Builder $query) use ($request): void {
                $search = '%'.$request->string('search')->toString().'%';
                $query->where(function (Builder $query) use ($search): void {
                    $query->where('event', 'like', $search)
                        ->orWhere('subject_type', 'like', $search)
                        ->orWhereHas('actor', fn (Builder $query) => $query->where('name', 'like', $search)->orWhere('email', 'like', $search));
                });
            })
            ->when($request->filled('event'), fn (Builder $query) => $query->where('event', $request->string('event')->toString()))
            ->when($request->filled('actor'), fn (Builder $query) => $query->where('actor_id', $request->integer('actor')))
            ->when($request->filled('date_from'), fn (Builder $query) => $query->whereDate('created_at', '>=', $request->date('date_from')))
            ->when($request->filled('date_to'), fn (Builder $query) => $query->whereDate('created_at', '<=', $request->date('date_to')))
            ->latest('id')
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('admin/audit-logs/index', [
            'logs' => $logs,
            'actors' => User::query()->whereHas('auditLogs')->orderBy('name')->get(['id', 'name']),
            'events' => AuditLog::query()->distinct()->orderBy('event')->pluck('event'),
            'filters' => $request->only(['search', 'event', 'actor', 'date_from', 'date_to']),
        ]);
    }
}
