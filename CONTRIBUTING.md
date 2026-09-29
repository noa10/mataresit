# Contributing to Mataresit

Thanks for helping improve Mataresit. The project contains a React frontend, Supabase backend, database migrations, Edge Functions, and several test suites, so focused changes and clear validation are especially valuable.

## Before you start

- Search existing issues and pull requests before opening a new one.
- Keep changes focused on one feature or documentation topic.
- Use a development or feature branch rather than committing directly to `main`.
- Never commit `.env.local` files, API keys, service-role keys, Stripe secrets, production URLs, or real receipt data.
- Do not run database or Edge Function deployment commands against production as part of local development.

## Development setup

```bash
git clone https://github.com/noa10/mataresit.git
cd mataresit

nvm use
npm ci
cp .env.example .env.local
```

For isolated local Supabase development:

```bash
supabase start
supabase status
supabase db reset
```

Copy the local URL and anonymous key printed by `supabase status` into `.env.local`, then run:

```bash
npm run dev
```

`supabase db reset` affects the local database only. Review any migration or deployment command before using it against a shared environment. The `env:*` scripts are maintainer utilities and should not be used to point local development at production.

## Validation

Run the checks relevant to your change:

```bash
npm run lint
npm run test:unit
npm run test
npm run build
```

Integration, queue, alerting, and end-to-end tests may require additional Supabase, Stripe, AI-provider, or browser-test configuration. Do not add real credentials to make a test pass.

## Project conventions

- Use `@/` imports for internal frontend modules.
- Keep frontend changes consistent with the existing React, TypeScript, Tailwind, and shadcn-style component patterns.
- Keep server-side Edge Function secrets out of Vite variables and browser bundles.
- Add or update database migrations for schema changes; do not edit production data directly.
- Update English and Bahasa Malaysia locale resources when user-facing copy changes.
- Add or update tests for behavior changes where practical.

## Pull requests

A useful pull request should explain:

1. What problem it solves.
2. Which parts of the frontend, database, or Edge Functions changed.
3. How the change was tested.
4. Any migrations, secrets, deployment steps, or documentation updates required.
5. Any known limitations or follow-up work.

Please keep generated files, dependency lockfile changes, screenshots, and unrelated formatting changes out of a pull request unless they are necessary for the change.
