<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRolesRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->route('user');

        return $user instanceof User && ($this->user()?->can('assignRoles', $user) ?? false);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'assignments' => ['present', 'array'],
            'assignments.*.role_id' => ['required', 'integer', 'distinct', 'exists:roles,id'],
            'assignments.*.expires_at' => ['nullable', 'date', 'after:now'],
        ];
    }

    /** @return list<array{role_id: int, expires_at: string|null}> */
    public function assignments(): array
    {
        $validated = $this->validated();
        $rawAssignments = $validated['assignments'] ?? [];
        $assignments = [];

        if (! is_array($rawAssignments)) {
            return [];
        }

        foreach ($rawAssignments as $assignment) {
            if (! is_array($assignment)) {
                continue;
            }

            $assignments[] = [
                'role_id' => (int) $assignment['role_id'],
                'expires_at' => filled($assignment['expires_at'] ?? null) ? (string) $assignment['expires_at'] : null,
            ];
        }

        return $assignments;
    }
}
