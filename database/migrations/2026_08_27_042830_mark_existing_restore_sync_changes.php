<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $previousChanges = [];
        $changes = DB::table('sync_changes')
            ->select(['cursor', 'user_id', 'entity_type', 'entity_id', 'operation', 'version'])
            ->orderBy('cursor')
            ->get();

        foreach ($changes as $change) {
            $key = $change->user_id.':'.$change->entity_type.':'.$change->entity_id;
            $previous = $previousChanges[$key] ?? null;
            $operation = $change->operation;

            if ($operation === 'upsert'
                && $previous !== null
                && $previous['operation'] === 'delete'
                && (int) $change->version > $previous['version']) {
                DB::table('sync_changes')
                    ->where('cursor', $change->cursor)
                    ->update(['operation' => 'restore']);
                $operation = 'restore';
            }

            $previousChanges[$key] = [
                'operation' => $operation,
                'version' => (int) $change->version,
            ];
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('sync_changes')
            ->where('operation', 'restore')
            ->update(['operation' => 'upsert']);
    }
};
