<?php

namespace App\Http\Controllers;

use App\Http\Requests\PushSyncRequest;
use App\Models\User;
use App\Services\Sync\PullSyncService;
use App\Services\Sync\PushSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SyncController extends Controller
{
    public function __construct(
        private readonly PushSyncService $pushSyncService,
        private readonly PullSyncService $pullSyncService,
    ) {}

    public function health(Request $request): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'user_id' => $request->user()?->getAuthIdentifier(),
            'server_time' => now()->toISOString(),
        ]);
    }

    public function push(PushSyncRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        /** @var array{device_id: string, mutations: list<array<string, mixed>>} $validated */
        $validated = $request->validated();

        return response()->json($this->pushSyncService->push(
            $user,
            $validated['device_id'],
            $validated['mutations'],
        ));
    }

    public function pull(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cursor' => ['sometimes', 'integer', 'min:0'],
            'limit' => ['sometimes', 'integer', 'between:1,100'],
        ]);
        /** @var User $user */
        $user = $request->user();

        return response()->json($this->pullSyncService->pull(
            $user,
            (int) ($validated['cursor'] ?? 0),
            (int) ($validated['limit'] ?? 100),
        ));
    }
}
