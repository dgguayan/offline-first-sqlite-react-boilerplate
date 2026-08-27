<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StorePermissionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->hasPermissionTo('permissions.manage') ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'permission_module_id' => ['required', 'integer', 'exists:permission_modules,id'],
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'regex:/^[a-z0-9-]+\.[a-z0-9-]+$/', 'unique:permissions,slug'],
            'action' => ['required', 'string', 'max:100', 'alpha_dash:ascii'],
            'description' => ['nullable', 'string', 'max:2000'],
            'allowed_scopes' => ['required', 'array', 'min:1'],
            'allowed_scopes.*' => ['required', 'distinct', 'in:all,department,own'],
        ];
    }
}
