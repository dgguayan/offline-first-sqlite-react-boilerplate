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
        Schema::create('sync_changes', function (Blueprint $table) {
            $table->bigIncrements('cursor');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('entity_type', 30);
            $table->uuid('entity_id');
            $table->string('operation', 20);
            $table->unsignedBigInteger('version');
            $table->json('record');
            $table->timestamps();

            $table->index(['user_id', 'cursor']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sync_changes');
    }
};
