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
        Schema::table('users', function (Blueprint $table) {
            $table->string('registration_source')->default('admin')->index()->after('status');
            $table->timestamp('verification_expires_at')->nullable()->index()->after('deactivated_at');
            $table->timestamp('approved_at')->nullable()->after('verification_expires_at');
            $table->foreignId('approved_by')->nullable()->after('approved_at')->constrained('users')->nullOnDelete();
            $table->timestamp('declined_at')->nullable()->after('approved_by');
            $table->foreignId('declined_by')->nullable()->after('declined_at')->constrained('users')->nullOnDelete();
            $table->text('decline_reason')->nullable()->after('declined_by');
        });

        DB::table('users')
            ->whereIn('status', ['active', 'inactive'])
            ->update(['approved_at' => DB::raw('created_at')]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['approved_by']);
            $table->dropForeign(['declined_by']);
            $table->dropIndex(['registration_source']);
            $table->dropIndex(['verification_expires_at']);
            $table->dropColumn([
                'registration_source',
                'verification_expires_at',
                'approved_at',
                'approved_by',
                'declined_at',
                'declined_by',
                'decline_reason',
            ]);
        });
    }
};
