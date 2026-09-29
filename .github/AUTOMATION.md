# Mataresit GitHub automation

This directory contains GitHub Actions, security configuration, Dependabot configuration, and maintainer notes for Mataresit.

The canonical product and contributor overview is the [root README](../README.md).

## Current workflow model

Mataresit uses a Vercel frontend and Supabase backend. GitHub Actions validates and protects the repository; it does not replace the Vercel Git integration or the required Supabase deployment steps.

| Workflow | Purpose |
| --- | --- |
| [`ci.yml`](./workflows/ci.yml) | Node.js 20 dependency install, linting, type checking, tests, build validation, and deployment-readiness checks |
| [`security-scan.yml`](./workflows/security-scan.yml) | CodeQL, dependency auditing, frontend checks, Supabase checks, and secret scanning |
| [`monitoring.yml`](./workflows/monitoring.yml) | Scheduled application, Supabase, performance, security, and alert-system health checks |
| [`supabase-validate.yml`](./workflows/supabase-validate.yml) | Supabase configuration, migration, and Edge Function validation |
| [`dependabot.yml`](./dependabot.yml) | Dependency update configuration |

## Deployment responsibilities

- **Frontend:** Vercel Git integration builds the Vite application and deploys `dist`.
- **Database and backend:** Supabase manages Postgres, Auth, Storage, Realtime, and Edge Functions.
- **Migrations:** maintainers apply database migrations through the Supabase workflow after validation.
- **Edge Functions:** maintainers deploy the required functions and configure their server-side secrets.
- **CI/CD:** GitHub Actions reports quality, security, and readiness results; it is not a Kubernetes or Docker deployment pipeline.

## Maintainer notes

- Keep Node.js versions aligned with [`.nvmrc`](../.nvmrc) and the workflows.
- Never place production secrets in workflow logs, documentation, or pull requests.
- Do not point local development at a shared Supabase project.
- Treat older deployment notes as historical until they match the current Vercel + Supabase architecture.
- Update this file when workflows are added, removed, or renamed.
