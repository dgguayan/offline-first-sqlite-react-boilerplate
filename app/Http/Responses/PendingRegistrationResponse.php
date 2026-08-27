<?php

namespace App\Http\Responses;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Fortify\Contracts\RegisterResponse;
use Symfony\Component\HttpFoundation\Response;

class PendingRegistrationResponse implements RegisterResponse
{
    /** @param Request $request */
    public function toResponse($request): Response
    {
        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        $message = 'Registration submitted. An administrator must approve your account before you can sign in.';

        if ($request->wantsJson()) {
            return new JsonResponse([
                'message' => $message,
                'status' => User::StatusPending,
            ], 202);
        }

        return to_route('login')->with('status', $message);
    }
}
