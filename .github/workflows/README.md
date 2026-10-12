# GitHub Actions workflows

Mataresit uses GitHub Actions for validation, security checks, and scheduled monitoring. Frontend deployments are handled by the Vercel Git integration; Supabase migrations and Edge Functions are deployed by maintainers after validation.

## Active workflows

| Workflow | Trigger | Responsibility |
| --- | --- | --- |
| `ci.yml` | Relevant pushes and pull requests | Install dependencies, lint, type-check, run tests, build, and evaluate deployment readiness |
| `security-scan.yml` | Scheduled runs, relevant pushes, pull requests, and manual dispatch | Run CodeQL, dependency audits, frontend checks, Supabase checks, and secret scanning |
| `monitoring.yml` | Scheduled runs and manual dispatch | Check application, Supabase, performance, security, and alert-system health |
| `supabase-validate.yml` | Supabase changes, pull requests, and manual dispatch | Validate configuration, migration naming/syntax, and Edge Function structure |
| `supabase-keepalive.yml` | Daily schedule and manual dispatch | Write one row into `keepalive_pings` so the free-tier Supabase project is never paused for inactivity |
| `weekly-receipt-smoke-test.yml` | Weekly schedule and manual dispatch | Create, read back, and delete a receipt through the external API to verify the product path end to end |

## Required secrets and variables

These workflows read the secrets below. **A missing secret makes every `secrets.*` reference resolve to an empty string**, so the workflows deliberately fail rather than skip when one is absent — a green run that silently did nothing is worse than a red one.

| Secret | Used by | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | keepalive, smoke test, monitoring | Project URL, e.g. `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | smoke test, monitoring | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | keepalive, monitoring | Service role key; bypasses RLS to write the keepalive ledger |
| `TEST_API_KEY` | smoke test | An active `mk_test_` key with `receipts:write` and `receipts:delete` |
| `STAGING_*` equivalents | all of the above | Optional staging environment |

Also set the repository variable `APP_DOMAIN` to the current frontend host.

## Supabase keepalive

Supabase pauses Free plan projects after roughly 7 days without sufficient user database activity. A paused project stops resolving its hostname entirely, so every API call fails until someone resumes it from the dashboard (there is a limited ~1 year restore window).

`supabase-keepalive.yml` prevents this by inserting one row per day into `public.keepalive_pings`, which is the documented activity threshold. Apply the migration first:

```bash
npm run supabase:push
```

The workflow:

- Fails immediately if the required secrets are unset.
- Checks that the project hostname resolves before pinging, so a paused project is reported as *paused* rather than as a generic connection error.
- Reads the row back to confirm the write actually landed.
- Opens a labelled issue on failure and closes it automatically once healthy.

`weekly-receipt-smoke-test.yml` covers the path the daily ping does not: an authenticated API request that creates a receipt, reads it back, and deletes it. It needs `TEST_API_KEY`; without it the job warns and exits successfully.

Both workflows depend on `keep-repo-active`, which resets GitHub's 60-day scheduled-workflow inactivity clock. Without it, GitHub auto-disables `schedule:` workflows in a public repository after 60 days without repository activity — which is how the keepalive itself would stop running unnoticed.

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
