<?php

namespace App\Models;

use Database\Factories\BrandingSettingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $system_name
 * @property string|null $logo_path
 * @property string $layout
 * @property string $title_alignment
 * @property string $title_overflow
 * @property int $sidebar_logo_size
 * @property bool $use_custom_logo
 * @property int|null $updated_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class BrandingSetting extends Model
{
    /** @use HasFactory<BrandingSettingFactory> */
    use HasFactory;

    public const Horizontal = 'horizontal';

    public const Vertical = 'vertical';

    public const LogoOnly = 'logo-only';

    public const TitleOnly = 'title-only';

    public const AlignLeft = 'left';

    public const AlignCenter = 'center';

    public const AlignRight = 'right';

    public const OverflowEllipsis = 'ellipsis';

    public const OverflowClip = 'clip';

    public const OverflowWrap = 'wrap';

    public const DefaultSidebarLogoSize = 32;

    public const MinimumSidebarLogoSize = 24;

    public const MaximumSidebarLogoSize = 216;

    /** @var list<string> */
    public const Layouts = [
        self::Horizontal,
        self::Vertical,
        self::LogoOnly,
        self::TitleOnly,
    ];

    /** @var list<string> */
    public const TitleAlignments = [
        self::AlignLeft,
        self::AlignCenter,
        self::AlignRight,
    ];

    /** @var list<string> */
    public const TitleOverflows = [
        self::OverflowEllipsis,
        self::OverflowClip,
        self::OverflowWrap,
    ];

    /** @var list<string> */
    protected $fillable = [
        'system_name',
        'logo_path',
        'layout',
        'title_alignment',
        'title_overflow',
        'sidebar_logo_size',
        'use_custom_logo',
        'updated_by',
    ];

    /** @return BelongsTo<User, $this> */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'sidebar_logo_size' => 'integer',
            'use_custom_logo' => 'boolean',
        ];
    }
}
