<?php

namespace App\Http\Requests\Settings;

use App\Models\BrandingSetting;
use App\Rules\SafeSvg;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\File;

class UpdateBrandingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->hasPermissionTo('settings.manage-branding') ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'system_name' => ['required', 'string', 'min:1', 'max:100'],
            'layout' => ['required', 'string', Rule::in(BrandingSetting::Layouts)],
            'title_alignment' => ['required', 'string', Rule::in(BrandingSetting::TitleAlignments)],
            'title_overflow' => ['required', 'string', Rule::in(BrandingSetting::TitleOverflows)],
            'sidebar_logo_size' => [
                'required',
                'integer',
                'between:'.BrandingSetting::MinimumSidebarLogoSize.','.BrandingSetting::MaximumSidebarLogoSize,
            ],
            'remove_logo' => ['required', 'boolean'],
            'logo' => [
                'bail',
                'nullable',
                Rule::prohibitedIf($this->boolean('remove_logo')),
                File::image(allowSvg: true)
                    ->extensions(['png', 'jpg', 'jpeg', 'svg', 'webp'])
                    ->max('2mb'),
                new SafeSvg,
            ],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'logo.prohibited_if' => 'Choose a new logo or remove the current logo, not both.',
            'logo.extensions' => 'The logo must be a PNG, JPG, JPEG, SVG, or WebP file.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'system_name' => trim((string) $this->input('system_name')),
        ]);
    }
}
