# Offline‑First SQLite + React Boilerplate

A starter template that combines a Laravel backend (Inertia) with a modern React + TypeScript frontend built with Vite, tailored for offline-first apps using SQLite compiled to WebAssembly. It includes tooling for PWA support, linting/formatting, and frontend testing.

> Note: This repository contains both frontend (TypeScript / Vite / React / Inertia) and backend (Laravel) pieces. The frontend uses @sqlite.org/sqlite-wasm for an in-browser SQLite database and vite-plugin-pwa for offline behavior.

Table of contents
- Features
- Requirements
- Quickstart (frontend)
- Running with Laravel backend
- Building for production
- Environment
- Testing
- Linting & formatting
- Notes on offline-first / SQLite-WASM
- Contributing
- License

## Features
- React + TypeScript frontend scaffolded with Vite
- Inertia.js (React) integration to work with a Laravel backend
- Browser-based SQLite via @sqlite.org/sqlite-wasm for local storage & queries
- PWA support (service worker) via vite-plugin-pwa for offline capabilities
- Tailwind + utilities and Radix UI components included
- Dev experience: ESLint, Prettier, Vitest for frontend tests
- Scripts for build, dev, lint, format, and type checking

## Requirements
- Node.js (recommended LTS, >= 18)
- npm, pnpm, or yarn (this repo contains a pnpm workspace file; package.json scripts use npm-compatible commands)
- PHP (for Laravel backend; target PHP 8.x as used in the repository)
- Composer (for PHP dependencies)
- A Laravel-compatible database for the backend (SQLite, MySQL, etc.) when running the server

## Quickstart — Frontend (development)
1. Clone the repo:
   git clone https://github.com/dgguayan/offline-first-sqlite-react-boilerplate.git
2. Change into the frontend root:
   cd offline-first-sqlite-react-boilerplate
3. Install JavaScript dependencies:
   npm install
   - or `pnpm install` if you prefer pnpm
4. Start the Vite dev server:
   npm run dev
5. Open the app in your browser at the URL shown by Vite (usually http://localhost:5173).

If you are running the Laravel backend concurrently, ensure the backend is running and configured to serve or proxy requests to the frontend as appropriate for your setup (see next section).

## Running with the Laravel backend
This repository includes Laravel configuration and files (artisan, composer files, config directories). Typical workflow:
1. Install PHP dependencies:
   composer install
2. Copy environment and set backend values:
   cp .env.example .env
   - Edit `.env` and set DB, APP_URL and other values as needed.
3. Run Laravel migrations / seeders (if present):
   php artisan migrate
4. Start the Laravel server:
   php artisan serve --port=8000
5. Start the frontend dev server (in a separate terminal):
   npm run dev

Depending on your workflow, you might set Vite and Laravel to work together using Inertia + vite-plugin; check the application's Vite config (`vite.config.ts`) if backend/frontend integration needs adjustment.

## Build for production
- Frontend:
  npm run build
  - This will create optimized assets for production (Vite).
  - The PWA plugin will generate the service worker and required assets.
- Backend:
  - Deploy Laravel as usual (Laravel Forge, Laravel Cloud, other hosts).
  - Ensure the built frontend assets are served by Laravel (see `@inertiajs/vite` usage in project).

## Environment
- Copy `.env.example` to `.env` and update values for local development.
- Common frontend scripts are in package.json:
  - dev — run vite dev server
  - build — produce production assets
  - build:ssr — build SSR bundles (if used)
  - format / format:check — Prettier formatting
  - lint / lint:check — ESLint checks / fixes
  - test:frontend — run Vitest
  - types:check — run tsc type checks

## Testing
- Frontend unit and integration tests run with Vitest:
  npm run test:frontend

## Linting & formatting
- Format code with Prettier:
  npm run format
- Lint and auto-fix with ESLint:
  npm run lint
- Check types:
  npm run types:check

## Offline-first & SQLite-WASM notes
- This boilerplate includes @sqlite.org/sqlite-wasm which allows you to run SQLite inside the browser (via WebAssembly). Use it to:
  - Store structured data locally,
  - Run SQL queries in-browser,
  - Synchronize with the server when connectivity is available.
- The project also configures a PWA service worker (vite-plugin-pwa) so the app can be installed and run offline; when combined with a local SQLite database you can build robust offline experiences.
- Typical offline flow:
  - Use SQLite-WASM for local persistence of user actions.
  - Queue and reconcile changes with the backend when online (implement conflict resolution / sync logic suited to your domain).

## Contributing
- Contributions welcome. Please follow the project's conventions:
  - Run and add tests for new features or fixes.
  - Follow the coding style (Prettier / ESLint / Pint for PHP).
  - When changing PHP code, run vendor/bin/pint (format) and `php artisan test` or `composer test` as appropriate.
- Open issues or PRs on GitHub.

## Where to go from here
- Examine `vite.config.ts`, `tsconfig.json`, and `package.json` to understand build and dev scripts.
- Review `.env.example` for environment variables used by the app.
- Inspect `AGENTS.md` for internal project guidance and Laravel-specific conventions if you will modify the backend.

## License
This repository does not specify a license. Add a LICENSE file if you plan to publish or accept contributions under a specific license.
