<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property int $user_id
 * @property string $device_id
 * @property string $entity_type
 * @property string $entity_id
 * @property string $operation
 * @property array<string, mixed> $result
 * @property Carbon $processed_at
 */
#[Fillable(['id', 'user_id', 'device_id', 'entity_type', 'entity_id', 'operation', 'result', 'processed_at'])]
class SyncMutation extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'result' => 'array',
            'processed_at' => 'datetime',
        ];
    }
}
