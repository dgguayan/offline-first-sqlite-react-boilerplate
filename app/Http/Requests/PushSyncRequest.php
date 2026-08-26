<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PushSyncRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'device_id' => ['required', 'uuid'],
            'mutations' => ['required', 'array', 'max:100'],
            'mutations.*' => ['required', 'array:id,entity_type,entity_id,operation,base_version,data'],
            'mutations.*.id' => ['required', 'uuid', 'distinct'],
            'mutations.*.entity_type' => ['required', Rule::in(['task', 'project'])],
            'mutations.*.entity_id' => ['required', 'uuid'],
            'mutations.*.operation' => ['required', Rule::in(['create', 'update', 'delete'])],
            'mutations.*.base_version' => ['nullable', 'integer', 'min:0'],
            'mutations.*.data' => ['required', 'array:id,title,completed,created_at,updated_at,deleted_at'],
            'mutations.*.data.id' => ['required', 'uuid'],
            'mutations.*.data.title' => ['required', 'string', 'max:200'],
            'mutations.*.data.completed' => ['required', 'boolean'],
            'mutations.*.data.created_at' => ['required', 'date'],
            'mutations.*.data.updated_at' => ['required', 'date'],
            'mutations.*.data.deleted_at' => ['nullable', 'date'],
        ];
    }
}
