<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('branding_settings', function (Blueprint $table) {
            $table->id();
            $table->string('system_name', 100);
            $table->string('logo_path')->nullable();
            $table->string('layout', 40)->default('horizontal');
            $table->boolean('use_custom_logo')->default(false);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        DB::table('branding_settings')->insert([
            'id' => 1,
            'system_name' => (string) config('app.name', 'Laravel'),
            'logo_path' => null,
            'layout' => 'horizontal',
            'use_custom_logo' => false,
            'updated_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('branding_settings');
    }
};
