import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.tsx',
                'offline.html',
            ],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        inertia(),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
        VitePWA({
            base: '/',
            scope: '/',
            outDir: 'public',
            registerType: 'prompt',
            injectRegister: null,
            includeAssets: [
                'favicon.ico',
                'favicon.svg',
                'apple-touch-icon.png',
            ],
            manifest: false,
            workbox: {
                cleanupOutdatedCaches: true,
                globDirectory: 'public',
                globPatterns: [
                    'build/**/*.{css,html,js,wasm}',
                    'favicon.{ico,svg}',
                    'apple-touch-icon.png',
                    'manifest.webmanifest',
                ],
                navigateFallback: '/build/offline.html',
                navigateFallbackDenylist: [
                    /^\/api(?:\/|$)/,
                    /^\/up$/,
                    /^\/(?:login|logout|register)(?:\/|$)/,
                    /^\/(?:forgot-password|reset-password)(?:\/|$)/,
                    /^\/(?:settings|verification|two-factor)(?:\/|$)/,
                ],
                runtimeCaching: [],
            },
        }),
    ],
    optimizeDeps: {
        exclude: ['@sqlite.org/sqlite-wasm'],
    },
    server: {
        watch: {
            ignored: [
                '**/.agents/**',
                '**/.claude/**',
                '**/.cursor/**',
                '**/.junie/**',
                '**/vendor/**',
            ],
        },
    },
});
