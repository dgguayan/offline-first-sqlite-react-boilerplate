<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $cursor
 * @property int $user_id
 * @property string $entity_type
 * @property string $entity_id
 * @property string $operation
 * @property int $version
 * @property array<string, mixed> $record
 */
#[Fillable(['user_id', 'entity_type', 'entity_id', 'operation', 'version', 'record'])]
class SyncChange extends Model
{
    protected $primaryKey = 'cursor';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cursor' => 'integer',
            'version' => 'integer',
            'record' => 'array',
        ];
    }
}
