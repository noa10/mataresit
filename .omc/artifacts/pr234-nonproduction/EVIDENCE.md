# PR #234 nonproduction verification evidence

Date: 2026-11-06
Branch: `fix/stripe-production-readiness`
Environment: disposable local Docker only. No hosted project, production
database, Stripe API, or secret value was accessed.

## SQL regression execution

Command:

```bash
bash .github/sql-regression/run-sql-regression.sh
```

Mode: disposable `postgres:15-alpine` container, tmpfs data, removed by trap.
PostgreSQL: 15.19 (aarch64-unknown-linux-musl).

Schema baseline:

1. `.github/sql-regression/bootstrap.sql` (roles, auth shims, Vault placeholder,
   marker table, pg_net test stub)
2. `20231126000000_initial_schema.sql`
3. `20231126000000` email-column shim
4. `20250115000000_add_subscription_schema.sql`
5. `20250120000000_fix_profiles_insert_policy.sql`
6. `20250722000000_enhance_billing_system_schema.sql`
7. `20261104000000_stripe_production_hardening.sql`
8. `20261104000001_batch_item_vault_trigger.sql`
9. `20261106000000_stripe_checkout_locks_and_payment_fencing.sql`

| Suite | Exit | Finished (UTC) |
|---|---|---|
| `stripe_webhook_claim_fencing` | 0 | 2026-11-06T09:38:43Z |
| `payment_state_fencing` | 0 | 2026-11-06T09:38:43Z |
| `stripe_checkout_locks` | 0 | 2026-11-06T09:38:45Z |
| `profile_billing_column_protection` | 0 | 2026-11-06T09:38:45Z |
| `batch_item_dispatch_config` | 0 | 2026-11-06T09:38:45Z |

Raw logs: same directory (`summary.tsv`, `migrations.log`, per-suite logs).

Re-run after the Phase 4 hardening changes (runner opt-in, `psql` host pin,
bootstrap guards): 2026-11-06T10:47:42Z–10:47:44Z, 5/5 exit 0.

### Suite defect fixes required before execution

- `supabase/tests/stripe_checkout_locks.sql`: declared `v_bound BOOLEAN` in the
  first DO block; it was assigned but never declared.
- `supabase/tests/payment_state_fencing.sql`: added the missing `END IF;`
  before the block's `END $$;`.

These defects prove the suites had not previously been executed.

## Credential sweep (security review finding)

Security review flagged a production `service_role` JWT in tracked docs as a
go-live blocker. A payload-role scan (not a value print) found five tracked
files carrying the same production project key:

| File | Kind |
|---|---|
| `docs/troubleshooting/WEBHOOK_DEBUGGING_GUIDE.md` | docs literal |
| `scripts/apply-missing-migrations.ts` | embedded fallback |
| `scripts/apply-quality-metrics-migration.ts` | embedded fallback |
| `scripts/setup-test-environment.js` | embedded constant |
| `tools/debug/check-receipts.js` | embedded constant |

All five now read the value from the environment and fail fast when it is
missing; the docs example uses `${SUPABASE_SERVICE_ROLE_KEY:?...}`. A repeat
scan reports zero `service_role` literals in the tracked tree (the ignored
`backups/2024-05-01/env.bak` is outside version control). `anon` literals in
test fixtures are public by design and were left alone.

Redaction is not revocation. Every one of these values remains in Git history
and must be rotated/revoked before cutover; that action stays user-gated.

## Phase 4 review outcomes

Security review: one critical and one medium finding, both addressed.

- Critical — production `service_role` JWT literals in tracked files: five
  files redacted (see credential sweep above); revocation remains user-gated.
- Medium — new CI job ran PR-controlled code with default token permissions:
  the job now declares `permissions: contents: read` and
  `persist-credentials: false`.
- Low — existing-container mode relied on a denylist alone: it now also
  requires `PR234_ALLOW_EXISTING=1`, and `bootstrap.sql` no longer replaces
  real `auth.uid()` / `auth.role()` or writes through a Vault view.

Code review: no blocking findings. Five medium and two low findings:

| Finding | Disposition |
|---|---|
| Artifact name collides on workflow re-run | Fixed: name includes `github.run_attempt` |
| Notify success and deployment gate ignore `sql-regression` | Fixed: `validate-deployment` needs the job and its `if:` requires success or skip; the success summary requires the same |
| `docker run` uses the default bridge network | **Rejected**: `--network none` is present in `docker run`; the reviewer read a stale line range |
| Existing-mode bootstrap conflicts with a real Supabase stack | Fixed: guarded Vault and auth-function creation |
| Type regeneration writes to a file the client does not import | Fixed: guide targets `src/types/supabase.ts`, which `client.ts` imports |
| Truncated CI comment block | Fixed |
| Docs overstate baseline fidelity | Fixed: both docs now name the baseline migrations and the auth/Vault/pg_net stubs |

Residual code-review notes accepted without change: `postgres:15-alpine` stays a
mutable tag (digest pinning is environment policy; `PR234_POSTGRES_IMAGE`
accepts one), `docker inspect` also matches images (the explicit opt-in and
marker gate bound the risk), and `BillingAuditRow.invoice_url` never receives a
value because the webhook writes `invoice_id` — a pre-existing data-contract
bug recorded as a follow-up, not introduced here.

## Two-session race results

`.github/sql-regression/two-session-races.sh` opens two real connections to the
same target and races the lock/claim RPCs. It runs at the end of
`run-sql-regression.sh`, so CI executes it too.

| Check | Result |
|---|---|
| Two concurrent `try_acquire_checkout_lock` calls | exactly one winner; loser returns `false` with no token |
| Bind/release | foreign token rejected, second bind rejected, release by bound session id succeeds |
| Delayed completion | stale session id cannot release a newer lock |
| Two concurrent `claim_stripe_webhook_event` calls | one `claimed`, one `in_flight` |
| Stale claim | reclaimer wins; old token raises `stale or superseded` |
| Processed event / expired lock | `duplicate`; expired lock stealable exactly once |

Run on 2026-11-06 against both the local stack and a disposable PostgreSQL 15
container: all six checks passed in each (`summary.tsv` row
`two_session_races 0`).

## Five review findings re-verified

| Finding | Evidence |
|---|---|
| Service-role billing-column access | `profile_billing_column_protection` suite exit 0 |
| Event-order table/function ordering | `stripe_webhook_claim_fencing` suite exit 0 |
| Live-claim lease behavior | `stripe_webhook_claim_fencing` suite exit 0 |
| Webhook claim-error handling | `stripe_webhook/claim_error_static_test.ts` (Deno) passed |
| Batch trigger `RETURN NEW` | `batch_item_dispatch_config` suite exit 0 |

## Other verification

- `deno test --no-lock --no-check --allow-all` on the focused billing/webhook
  tests: 80 passed, 0 failed (2026-11-06, after the review-round changes).
- `npm run test:unit`: 45 files, 279 tests passed.
- `npm run build`: exit 0.
- `tsc -p tsconfig.app.json --noEmit --incremental false`: 2,619 pre-existing
  diagnostics (baseline 2,634); zero `BillingPreferences.tsx`,
  `StripeContext.tsx`, or `config/stripe.ts` diagnostics. No claim that
  app-wide `tsc` passes.
- Runner negative test:
  `SUPABASE_DB_CONTAINER=supabase_db_oxtauhhixztusjlxcipo` →
  `refusing: container ... is a protected or unrelated stack`, exit 2.

## Latest review round (head `a316a8c`, 2026-11-06)

Four findings from the `tghbrk` review of `a316a8c`:

| Finding | Disposition | Evidence |
|---|---|---|
| P1: `recorded` payment still runs renewal tracking, which fails the order check and 500s a recorded out-of-order payment | Fixed: renewal tracking runs only when `paymentOutcome === 'applied'` | New static regression `an out-of-order recorded payment does not advance renewal tracking` |
| P2: post-create/pre-bind failure releases a lock whose Checkout Session is still completable | Fixed: `createdSession` gates release; incomplete sessions are expired before release | New static regression `a created checkout session keeps its lock until bound or expired` |
| P2: every mutation mints a random Stripe idempotency key, so HTTP retries execute a second mutation | Fixed: `x-idempotency-key` is validated (`8–128` of `A–Z a–z 0–9 _ -`), scoped to action/user/parameters, and forwarded to cancel/resume/change-plan/schedule mutations; the browser client keeps a key only while the outcome is ambiguous | 5 new tests in `manageSubscriptionActions.test.ts` (replay of cancel/scheduled downgrade, no re-mutation after an applied resume, parameter scoping, key validation) |
| P1: deployment gate and success notification still accept `sql-regression: skipped` | Fixed: both require `needs.sql-regression.result == 'success'` | Workflow diff |

Latest disposable PostgreSQL run: 6/6 suites exit 0, including
`two_session_races 0`, finished 2026-11-06T11:53:43Z.

## CI execution observed

Push of `a316a8c` triggered `Supabase Code Validation` (run 42208468160).
`Stripe SQL Regression` (job 127860977562) passed in 13s, including the
"Run disposable PostgreSQL suites" and "Upload SQL regression logs" steps.
`Validate Supabase Configuration` (the deployment gate that now depends on the
SQL job) and `Notify Deployment Status` also passed. CI execution is no longer
unobserved.

Push of `b1477e2` (review-round fixes) triggered run 42229507565 /
42229507621. All 21 checks pass, including `Stripe SQL Regression` (job
127931526225, 24s — the suite and two-session races ran in CI),
`Validate Supabase Configuration` (40s, now requiring that job's success),
`Test Suite` (1m3s), `CodeQL`, and Vercel preview. The tightened gate was
therefore exercised end-to-end on this head.

## Live test-mode lifecycle matrix (2026-11-07)

Environment: local nonproduction Supabase stack `pr234nonprod` (kong
`127.0.0.1:54431`) running the branch's three billing functions with a real
test-mode Stripe secret key from the auto-receipt account (`acct_1RShZxPHa6JfBjtM`),
test prices `price_1RSigg…` (pro monthly $9.99), `price_1RSik1…` (max annual
$199.99), and the real hosted Checkout UI driven by headless Playwright.
Users `lifecycle-p1@pr234.local` … `lifecycle-p5@pr234.local` were created in
the local stack's auth. The account's only registered webhook endpoint is the
production one, so `stripe listen` forwarding and `events resend` were not
usable; events were delivered by fetching them with `stripe events retrieve`
and POSTing them with a computed `Stripe-Signature` (`t=…,v1=…` HMAC over the
exact bytes) to the local function. The production endpoint was never a
delivery target, and no secret value was printed or stored outside the
gitignored local env file.

Bug found by the matrix and fixed on this branch: the webhook verified
signatures with the synchronous `stripe.webhooks.constructEvent`, which throws
"SubtleCryptoProvider cannot be used in a synchronous context" on the Deno
edge runtime — every webhook would 400 in production. The function now uses
`constructEventAsync` with `Stripe.createSubtleCryptoProvider()`. Pre-existing
on `main` since the original Stripe integration; first caught by this matrix.

| Scenario | Expected | Observed |
|---|---|---|
| Two `create-checkout-session` calls, one user | one session; second reuses or `SUBSCRIPTION_EXISTS` | Second concurrent call returned the same open session (`reused: true`); no duplicate lock or session |
| Checkout completion | lock released by exact session id; tier updated once | Profile `free→pro`, subscription bound, lock released (0 rows), idempotency row `processed` (attempts=1) |
| Upgrade pro→max with proration | invoice raised; tier must not exceed paid tier until collection | Two `invoiceitem.created` proration items raised (collected on the next invoice); **known limitation observed live**: `changePlan` synced tier=max before collection, as documented |
| Cancel at period end → resume | cancellation preserved; no tier change until period end | `cancel_at_period_end=true` with tier unchanged; resume restored `false`; no tier change at any point |
| Interval switch monthly→annual | new price; interval synced | `billing_interval=annual`; proration invoice raised and collected ($190.02 = $199.99 − $9.99 credit); payment row recorded; `next_billing_date` advanced to 2027 |
| `invoice.payment_failed` → recovery | grace/retry rows once per invoice; repeat delivery short-circuits | Profile `active→past_due`; one `payment_retry_tracking` row for the invoice (amount hardcoded 9999 — documented limitation); recovery payment → `active`, retry row `succeeded`, payment row recorded; redelivery returned `duplicate: true` |
| 3DS card `4000002500003155` | completes after authentication; no duplicate payment row | Hosted Checkout 3DS2 challenge clicked in headless Chromium; redirect observed; profile `pro`/`active`; exactly one payment row; lock released |
| Replay processed event | short-circuit | `200 {"duplicate": true}` |
| Older event after newer | recorded / no state advance | Older `customer.subscription.updated` rejected 500 with "older than the newest processed subscription event"; state unchanged. Payment-family "recorded" path stays covered by the SQL suite |
| Same-second event burst | rejected for reconciliation (documented) | The `customer.subscription.updated` created in the same second as `checkout.session.completed` fails closed with `serialization_failure` on every retry until the next later-created event applies; state remains correct from the checkout handler; retry churn during Stripe's retry window is accepted by design |
| Failed claim reclaim | expired/failed claims retakeable | The invoice event processed on attempt 2 after a handler-side schema fix |

Also verified live: renewal tracking (`subscription_renewal_tracking` row with
correct period start/end/next renewal), `next_billing_date` bookkeeping, and
that failed deliveries record `last_error` detail.

## Worker-past-lease fence experiment (2026-11-08)

Live replay of the stalled-worker scenario against the local `pr234nonprod`
stack (user `p6`, regular-card checkout → `checkout.session.completed` and
`invoice.payment_succeeded`). A stack-only test hook (`x-pr234-test-pause-ms`
header; hook since removed from the stack copy) stalled a delivery after it
acquired the 300s claim lease.

| Observation | Phase A (subscription family) | Phase B (payment family) |
|---|---|---|
| Stalled worker holds claim | `processing`, attempts=1; state untouched (`free`, 1 lock) | same |
| Second delivery while lease live | **409** `in_flight` | **409** `in_flight` |
| Delivery after lease expiry (t+335s) | **200** — reclaim + apply: tier `pro`, lock released, event `processed` (attempts=2) | **200** — reclaim + apply: exactly 1 payment row |
| Stalled worker wakes (t+360s) | **504** (kong timeout) — fenced writes rejected: "Stripe webhook claim … is stale or superseded" | **504** — same rejection for the payment sync |
| Final state | `pro`/`active`, 0 locks, no regression | exactly 1 payment row, no duplicate |

Both fenced syncs rejected the stale token; the reclaimer's state stood
unchanged after the stalled worker woke. This is the live counterpart of the
SQL two-session race checks (stale-claim rejection, reclaim) and closes the
last live gap the PR body listed. Stack hook removed after the run.

## Not verified (user-gated)

- Live/test-mode Stripe lifecycle: **executed 2026-11-07 — see the matrix
  section above.** Remaining live gap: the concurrency-only checks (worker
  paused past its lease) stay user-gated nonproduction checks before cutover.
- Production migration application and Vault secret creation. Blocked by the
  execution policy that forbids this session from querying or writing the
  linked production project; runbook added at
  `docs/runbooks/production-cutover.md`.
- Credential history purge. Blocked by force-push policy; runbook added at
  `docs/runbooks/credential-history-purge.md`.
- App-wide TypeScript baseline and the CI root-`tsc` blind spot.
