<?php

namespace App\Console\Commands;

use App\Services\RegistrationExpirationService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('users:expire-pending-registrations')]
#[Description('Decline and delete self-registered accounts whose verification period has expired')]
class ExpirePendingRegistrations extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(RegistrationExpirationService $expirationService): int
    {
        $result = $expirationService->expireDueRegistrations();

        $this->info("Expired {$result['expired']} pending registration(s).");

        if ($result['failed'] > 0) {
            $this->error("{$result['failed']} registration(s) could not be expired and will be retried.");

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
