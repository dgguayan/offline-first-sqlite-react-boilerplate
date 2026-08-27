<?php

namespace Database\Seeders;

use App\Models\RegistrationSetting;
use Illuminate\Database\Seeder;

class RegistrationSettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        RegistrationSetting::current();
    }
}
