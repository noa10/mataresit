# Profile-scoped billing reconciliation design

Status: design for PR #234 follow-through · 2026-11-08
Branch: `fix/stripe-production-readiness`
Companion evidence: `.omc/artifacts/pr234-nonproduction/EVIDENCE.md`

## 1. Purpose

PR #234 fences every entitlement-bearing billing write behind the webhook
claim: profile tier/status/subscription binding, payment history, grace and
retry tracking, and renewal tracking are claim-fenced and order-gated
(`20261104000000_stripe_production_hardening.sql`,
`20261106000000_stripe_checkout_locks_and_payment_fencing.sql`). What remains
unfenced is deliberately documented as best-effort:

- `invoice.finalized` writes `profiles.next_billing_date` directly
  (`supabase/functions/stripe-webhook/index.ts`, `handleInvoiceFinalized`);
- `payment_method.attached` / `detached` and `setup_intent.succeeded` write
  card display fields, and maintain the profile's active
  `stripe_payment_method_id`, directly;
- reminder scheduling, transactional emails, and audit rows happen outside the
  fence and are at-least-once;
- `manage-subscription` admin syncs (`syncSubscriptionToProfile`) and the
  `billing-auto-renewal` cron path are unfenced by design.

These writes cannot regress entitlements, but they can drift from Stripe
truth, and a last-writer-wins race between an admin sync and a concurrently
delivered webhook can leave a profile showing a stale tier or renewal date.
This document specifies the **profile-scoped reconciliation** that closes that
gap: a recurring job that re-reads Stripe as the source of truth for every
profile with a bound subscription and applies diffs through an order-aware,
profile-scoped write path.

## 2. Source of truth and scoping rule

Stripe is the source of truth for subscription state. Every reconciliation
write is scoped by the subscription bound to the profile:

```
profiles.stripe_subscription_id — the only subscription a write may target
```

A reconciliation write must never touch a profile whose bound subscription id
does not match the subscription whose state is being applied. This closes the
residual limitation recorded in the PR: `apply_fenced_profile_status` can
still update the display status of a profile whose `stripe_subscription_id`
is NULL when a late event for a deleted subscription arrives — reconciliation
never writes to an unbound profile, so the same late event cannot regress it.

## 3. Inventory and risk classes

| Write | Path | Class | Disposition |
|---|---|---|---|
| Profile tier/status/binding, payment history, grace/retry, renewal tracking | `apply_fenced_*` RPCs | entitlement | fenced — shipped in this PR |
| `invoice.finalized` → `profiles.next_billing_date` | `handleInvoiceFinalized` | bookkeeping | self-healing via reconciliation |
| Card display fields + active payment-method pointer | `payment_method.*` / `setup_intent.succeeded` handlers | bookkeeping | self-healing via reconciliation |
| Reminder scheduling + emails + audit rows | outside the fence | at-least-once | alerting only; not reconciled |
| Admin syncs | `syncSubscriptionToProfile` | administrative | order-aware admin apply (§5) |

## 4. Failure modes the design must close

1. **Stalled worker past its lease** — a delivery claims the event, stalls,
   and its lease expires; another delivery reclaims and applies state; the
   stalled worker wakes and must not apply stale state. Verified live against
   the local stack (see EVIDENCE.md, worker-past-lease section): the fenced
   RPCs reject the stale token, the reclaimer applies, and no duplicate rows
   exist.
2. **Out-of-order events** — an older event arriving after newer state is
   rejected for the subscription family (500, retryable) and recorded for the
   payment family; order is asserted per (subscription, event family) by
   `assert_stripe_event_order`.
3. **Webhook loss beyond Stripe's retry window** — profile state diverges
   from Stripe; reconciliation is the repair path.
4. **Admin-sync race** — `syncSubscriptionToProfile` is last-writer-wins; a
   concurrently delivered webhook can write newer state first and then be
   overwritten by a stale admin response, or the reverse. §5 makes admin
   applies order-aware.
5. **Same-second event bursts** — `assert_stripe_event_order` applies a
   deterministic total order over `(created, event id)`: distinct events
   created in the same second are ordered by event id, and a replay of the
   last applied event is accepted only when its `created` is not older.
   `20261110010000_stripe_fencing_regressions.sql` replaces the previous
   fail-closed rule that raised `serialization_failure` and left the losing
   delivery retrying forever. `supabase/tests/stripe_fencing_regressions.sql`
   pins the ordering, subscription scoping, and payment/renewal fencing
   regressions.

## 5. Design

### 5.1 Reconciliation worker

A scheduled Edge Function (pattern: existing `billing-auto-renewal` cron) that
runs per profile with a non-null `stripe_subscription_id`:

1. Fetch the subscription from Stripe by the profile's bound id — never by
   customer id and never across profiles.
2. Compute expected profile columns: tier (price-id → tier via
   `supabase/functions/_shared/stripe-config.ts`), status, billing interval,
   `cancel_at_period_end`, period end.
3. Diff against the profile. No diff → skip. Diff → apply via the admin apply
   RPC (§5.2).
4. Recompute the bookkeeping fields the unfenced handlers own —
   `next_billing_date` and card display fields — from the same Stripe
   objects.
5. Record the pass: `profiles.billing_synced_at`, a source marker, and a drift
   row in a service-role-only `billing_reconciliation_log` table (new) for
   alerting.

### 5.2 Order-aware admin apply RPC

New SQL RPC `apply_admin_stripe_subscription_state` (SECURITY DEFINER,
service-role only):

- asserts order against `stripe_subscription_event_order` for the bound
  subscription using a synthetic event key `admin:<unix-seconds>` with
  `created = now()`,
- applies only when Stripe truth is not older than the newest applied webhook
  event for that subscription (older-truth applies are skipped and logged),
- writes only the diffed columns on the profile matching the bound
  subscription id, never an unbound profile.

### 5.3 What the design deliberately does not decide

These stay owner/product decisions and are **not** resolved by this design:

- **Upgrade-before-proration ADR** — `change_plan` still uses
  `create_prorations` and syncs the tier before collection (blocker 4 in the
  PR body). The reconciliation worker would report this drift as a warning,
  not silently "fix" it by downgrading a paid upgrade.
- **Scheduled-downgrade visibility/recovery** —
  `schedulePlanChange` recovery remains open.
- **Alert routing** — who receives `billing_reconciliation_log` alerts
  (Slack/email routing is owner configuration).
- **Cancellation auto-apply** — whether reconciliation cancels a local
  subscription Stripe reports canceled; recommended yes, with an audit row.

## 6. Verification plan

- The live worker-past-lease experiment (EVIDENCE.md) proves the fence that
  reconciliation relies on: stale-token rejection, reclaim-and-apply, no
  duplicate payment rows.
- Proposed regression tests once implemented: drift detection (Stripe tier ≠
  profile tier → apply), unbound-profile safety (late event, no bound id → no
  write), admin-vs-webhook ordering (admin apply with Stripe truth older than
  the newest webhook event → skipped, logged).
- Existing suites keep passing: five billing SQL suites, two-session races,
  static fence regressions.

## 7. Ship path

This is a design deliverable, not an implementation commit. Implementation is
a follow-up: one migration (RPC + log table + grants), one Edge Function
(reconciliation worker), one cron schedule, and the three regression tests
above. It stays out of PR #234's diff to keep the hardening checkpoint
reviewable.
