<?php

namespace App\Models;

use Database\Factories\PermissionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property int $id
 * @property int $permission_module_id
 * @property string $name
 * @property string $slug
 * @property string $action
 * @property string|null $description
 * @property list<string> $allowed_scopes
 */
#[Fillable(['permission_module_id', 'name', 'slug', 'action', 'description', 'allowed_scopes'])]
class Permission extends Model
{
    /** @use HasFactory<PermissionFactory> */
    use HasFactory;

    /** @return BelongsTo<PermissionModule, $this> */
    public function module(): BelongsTo
    {
        return $this->belongsTo(PermissionModule::class, 'permission_module_id');
    }

    /** @return BelongsToMany<Role, $this> */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class)
            ->withPivot('scope')
            ->withTimestamps();
    }

    public function assignedScope(): string
    {
        return (string) $this->getRelation('pivot')->getAttribute('scope');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['allowed_scopes' => 'array'];
    }
}
