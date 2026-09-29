# Local Development Guide

This guide describes a safe local workflow for developing Mataresit. It does not use production credentials, production data, or a shared Supabase project.

## Principles

- Keep development data isolated from production.
- Never commit `.env.local`, API keys, service-role keys, Stripe secrets, or real receipts.
- Do not use `supabase db push` as part of normal local setup.
- Do not use a production-linked project for migrations, Edge Function deployment, or test data.
- Treat the `env:*` npm scripts as maintainer utilities and inspect them before using them.

## Prerequisites

- Node.js 20 (see [`.nvmrc`](../../.nvmrc))
- npm
- Supabase CLI
- Docker Desktop or another supported local container runtime for the Supabase stack
- A Gemini API key for AI receipt processing

## Install the frontend

```bash
git clone https://github.com/noa10/mataresit.git
cd mataresit

nvm use
npm ci
cp .env.example .env.local
```

## Start an isolated Supabase stack

Start the local Supabase services:

```bash
supabase start
```

Inspect the local connection values:

```bash
supabase status
```

Apply the migrations to the local database:

```bash
supabase db reset
```

`supabase db reset` is destructive for the local database. It must never be run against a shared or production project.

## Configure the frontend

Copy the local API URL and anonymous key printed by `supabase status` into `.env.local`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54331
VITE_SUPABASE_ANON_KEY=<local-anon-key-from-supabase-status>
# Leave VITE_SITE_URL unset locally so auth redirects stay on localhost.
```

Do not use a service-role key in a `VITE_` variable. Keep provider and Stripe secrets on the server side.

Start the frontend after the local values are configured:

```bash
npm run dev
```

The Vite server normally runs at `http://localhost:5173`.

## Edge Functions and AI secrets

Receipt processing, search embeddings, reports, billing, and notifications use Supabase Edge Functions. Configure the required functions and server-side secrets in the local Supabase environment or in a separate development Supabase project. When testing local email or notification links, set `SITE_URL` and `FRONTEND_URL` to `http://localhost:5173` in the local function environment.

Never put `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, Stripe secret keys, or webhook secrets in `VITE_` variables.

The primary receipt-processing flow is described in [`supabase/functions/process-receipt/README.md`](../../supabase/functions/process-receipt/README.md).

## Hosted development alternative

If local Supabase is not available, create a separate development project and configure only that project's public URL and browser-safe key in `.env.local`. Do not reuse a production project, service-role key, or production data.

## Validation commands

```bash
npm run lint
npm run test:unit
npm run test
npm run build
```

Integration, queue, alerting, and end-to-end tests may require additional test services and environment configuration. See [`package.json`](../../package.json) for the available scripts.

## Troubleshooting

### The frontend cannot reach Supabase

1. Run `supabase status`.
2. Confirm the URL and anonymous key in `.env.local`.
3. Restart Vite after changing environment variables.
4. Confirm the local Supabase services are running.

### Authentication does not work locally

Create a test user in the local Supabase instance. Local users and production users are separate.

### AI processing fails

Confirm that the required Edge Function is running and that its server-side provider secret is configured. Do not send real receipts to a development environment while diagnosing configuration.

### The wrong environment is selected

Stop the dev server and inspect `.env.local` manually. The `env:*` scripts may target maintainer-managed environments; do not use a production target for local development.
