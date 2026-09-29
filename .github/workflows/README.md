# GitHub Actions workflows

Mataresit uses GitHub Actions for validation, security checks, and scheduled monitoring. Frontend deployments are handled by the Vercel Git integration; Supabase migrations and Edge Functions are deployed by maintainers after validation.

## Active workflows

| Workflow | Trigger | Responsibility |
| --- | --- | --- |
| `ci.yml` | Relevant pushes and pull requests | Install dependencies, lint, type-check, run tests, build, and evaluate deployment readiness |
| `security-scan.yml` | Scheduled runs, relevant pushes, pull requests, and manual dispatch | Run CodeQL, dependency audits, frontend checks, Supabase checks, and secret scanning |
| `monitoring.yml` | Scheduled runs and manual dispatch | Check application, Supabase, performance, security, and alert-system health |
| `supabase-validate.yml` | Supabase changes, pull requests, and manual dispatch | Validate configuration, migration naming/syntax, and Edge Function structure |

## CI behavior

`ci.yml` uses Node.js 20 and reports:

- ESLint results
- TypeScript results
- Unit and integration test results
- Production build results
- A deployment-readiness summary

Some checks are intentionally non-blocking in the current workflow configuration. Review the workflow before treating a green check as proof that every quality gate passed.

## Security behavior

`security-scan.yml` includes:

- CodeQL analysis for JavaScript and TypeScript
- npm dependency auditing
- Frontend bundle and secret-pattern checks
- Supabase configuration and Edge Function checks
- TruffleHog and GitLeaks secret scanning

Never place secrets in workflow YAML, logs, artifacts, or documentation.

## Monitoring behavior

`monitoring.yml` runs scheduled health checks and can be dispatched manually. It checks the deployed frontend, Supabase services, Edge Functions, security headers, performance checks, and alerting paths. Notifications may create GitHub issues or use configured channels; do not assume Slack is enabled.

Set the repository variable `APP_DOMAIN` to the current frontend host when it changes. Until then, monitoring defaults to `mataresit.vercel.app`.

## Supabase deployment boundary

`supabase-validate.yml` is validation-oriented. It does not replace:

```text
review migrations → apply migrations → deploy required Edge Functions → configure secrets → run post-deployment checks
```

Use the Supabase CLI or project dashboard only with the correct explicitly selected project. Never run a remote migration or function deployment against production as part of local development.

## Legacy architecture

Earlier documentation referred to Kubernetes, Docker image pipelines, blue-green deployment, and automated Slack notifications. Those are not the current Mataresit deployment model. Keep the Vercel + Supabase architecture and the active workflow files above as the source of truth.
