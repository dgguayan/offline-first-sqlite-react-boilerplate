<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sync_mutations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('device_id');
            $table->string('entity_type', 30);
            $table->uuid('entity_id');
            $table->string('operation', 20);
            $table->json('result');
            $table->timestamp('processed_at');
            $table->timestamps();

            $table->index(['user_id', 'device_id', 'processed_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sync_mutations');
    }
};
