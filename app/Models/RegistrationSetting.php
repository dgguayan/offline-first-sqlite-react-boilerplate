<?php

namespace App\Models;

use Database\Factories\RegistrationSettingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RegistrationSetting extends Model
{
    /** @use HasFactory<RegistrationSettingFactory> */
    use HasFactory;

    public const DefaultPendingExpirationDays = 7;

    /** @var list<string> */
    protected $fillable = ['pending_expiration_days', 'updated_by'];

    public static function current(): self
    {
        return self::query()->firstOrCreate(
            ['id' => 1],
            ['pending_expiration_days' => self::DefaultPendingExpirationDays],
        );
    }

    /** @return BelongsTo<User, $this> */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['pending_expiration_days' => 'integer'];
    }
}
