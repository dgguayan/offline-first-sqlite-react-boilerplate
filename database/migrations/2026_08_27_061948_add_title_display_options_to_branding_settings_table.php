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
        Schema::table('branding_settings', function (Blueprint $table) {
            $table->string('title_alignment', 20)->default('left')->after('layout');
            $table->string('title_overflow', 20)->default('ellipsis')->after('title_alignment');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('branding_settings', function (Blueprint $table) {
            $table->dropColumn(['title_alignment', 'title_overflow']);
        });
    }
};
