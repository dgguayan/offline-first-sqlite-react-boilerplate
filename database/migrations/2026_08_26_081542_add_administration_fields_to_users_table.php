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
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->nullable()->unique()->after('name');
            $table->string('status')->default('active')->index()->after('password');
            $table->string('job_title')->nullable()->after('status');
            $table->string('department')->nullable()->index()->after('job_title');
            $table->string('phone')->nullable()->after('department');
            $table->text('bio')->nullable()->after('phone');
            $table->timestamp('last_login_at')->nullable()->after('bio');
            $table->timestamp('deactivated_at')->nullable()->after('last_login_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['username']);
            $table->dropIndex(['status']);
            $table->dropIndex(['department']);
            $table->dropColumn([
                'username',
                'status',
                'job_title',
                'department',
                'phone',
                'bio',
                'last_login_at',
                'deactivated_at',
            ]);
        });
    }
};
