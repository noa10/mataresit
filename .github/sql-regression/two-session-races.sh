#!/usr/bin/env bash
# Two genuinely concurrent sessions against the billing lock/claim RPCs.
#
# The SQL suites run in a single transaction, so they cannot prove that the
# primary-key and ON CONFLICT serialisation actually rejects a second writer.
# This harness opens two real connections and races them:
#
#   * try_acquire_checkout_lock  -> exactly one owner, loser gets no token
#   * bind/release               -> owner-scoped, single bind, exact-session release
#   * claim_stripe_webhook_event -> one claim, one in_flight
#   * stale claim                -> reclaimer wins, old token is rejected
#   * expired lock               -> stealable exactly once
#
# It writes committed rows (a race cannot run inside one rollback), so it uses a
# fixed test user and deletes its own rows on entry and exit.
#
# Target: run through run-sql-regression.sh, which exports PR234_RACE_CONTAINER.
# Standalone use requires PR234_RACE_CONTAINER or SUPABASE_DB_CONTAINER plus
# PR234_ALLOW_EXISTING=1, and never targets a protected stack.
set -euo pipefail

container="${PR234_RACE_CONTAINER:-${SUPABASE_DB_CONTAINER:-}}"
test_user="00000000-0000-4000-8000-0000000000c1"
event_prefix="evt_pr234_race"

refuse() { echo "refusing: $*" >&2; exit 2; }
fail() { echo "FAIL: $*" >&2; exit 1; }

[[ -n "$container" ]] || refuse "set PR234_RACE_CONTAINER (or run through .github/sql-regression/run-sql-regression.sh)"
if [[ -z "${PR234_RACE_CONTAINER:-}" && "${PR234_ALLOW_EXISTING:-0}" != "1" ]]; then
  refuse "standalone SUPABASE_DB_CONTAINER mode requires PR234_ALLOW_EXISTING=1"
fi
case "$container" in
  *oxtauhhixztusjlxcipo*|*mpmkbtsufihzdelrlszs*)
    refuse "container ${container} is a protected or unrelated stack"
    ;;
esac
docker inspect "$container" >/dev/null 2>&1 || refuse "container ${container} does not exist"

psql_exec() {
  docker exec -i "$container" psql -X -q -tA -v ON_ERROR_STOP=1 \
    -h /var/run/postgresql -U postgres -d postgres "$@"
}

present="$(psql_exec -c "SELECT to_regclass('public.pr234_verify_marker') IS NOT NULL")"
[[ "$present" == "t" ]] || refuse "target has no pr234_verify_marker; provision it with bootstrap.sql"

tmp="$(mktemp -d)"
clear_rows() {
  psql_exec -c "DELETE FROM public.stripe_checkout_locks WHERE user_id = '${test_user}'" >/dev/null 2>&1 || true
  psql_exec -c "DELETE FROM public.stripe_webhook_events WHERE event_id LIKE '${event_prefix}%'" >/dev/null 2>&1 || true
  psql_exec -c "DELETE FROM auth.users WHERE id = '${test_user}'" >/dev/null 2>&1 || true
}
cleanup() {
  clear_rows
  rm -rf "$tmp"
}
trap cleanup EXIT
clear_rows

psql_exec <<SQL >/dev/null
INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
VALUES ('${test_user}', 'authenticated', 'authenticated',
        'pr234-race-${test_user}@example.invalid', '{}'::jsonb,
        clock_timestamp(), clock_timestamp())
ON CONFLICT (id) DO NOTHING;
SQL

# race LABEL SQL_FILE: run the same SQL on two connections and return both outputs.
race() {
  local label="$1" sql="$2"
  psql_exec -f - < "$sql" >"${tmp}/${label}.1" 2>&1 &
  local pid1=$!
  psql_exec -f - < "$sql" >"${tmp}/${label}.2" 2>&1 &
  local pid2=$!
  wait "$pid1" || { cat "${tmp}/${label}.1" >&2; fail "${label}: session 1 errored"; }
  wait "$pid2" || { cat "${tmp}/${label}.2" >&2; fail "${label}: session 2 errored"; }
}

# ---------------------------------------------------------------------------
# 1. Checkout lock: two concurrent acquisitions for one user.
# ---------------------------------------------------------------------------
cat >"${tmp}/lock-race.sql" <<SQL
BEGIN;
SELECT pg_sleep(0.2);
SELECT acquired || '|' || COALESCE(lock_token::text, '-')
FROM public.try_acquire_checkout_lock('${test_user}'::uuid, 900);
SELECT pg_sleep(0.4);
COMMIT;
SQL

race "lock-race" "${tmp}/lock-race.sql"

winners="$(cat "${tmp}/lock-race.1" "${tmp}/lock-race.2" | grep -c '^true|' || true)"
losers="$(cat "${tmp}/lock-race.1" "${tmp}/lock-race.2" | grep -c '^false|-$' || true)"
[[ "$winners" == "1" ]] || { cat "${tmp}/lock-race.1" "${tmp}/lock-race.2" >&2; fail "lock race produced ${winners} winners"; }
[[ "$losers" == "1" ]] || { cat "${tmp}/lock-race.1" "${tmp}/lock-race.2" >&2; fail "lock race produced ${losers} clean losers"; }
winner_token="$(cat "${tmp}/lock-race.1" "${tmp}/lock-race.2" | grep '^true|' | cut -d'|' -f2)"
[[ "$winner_token" != "-" ]] || fail "winner returned no lock token"
echo "ok 1: exactly one of two concurrent acquisitions won (token ${winner_token:0:8}...)"

# ---------------------------------------------------------------------------
# 2. Binding and release are owner-scoped.
# ---------------------------------------------------------------------------
expect() { # expect VALUE LABEL SQL
  local want="$1" label="$2" sql="$3" got
  got="$(psql_exec -c "$sql" 2>&1)" || { echo "$got" >&2; fail "${label}: query errored"; }
  [[ "$got" == "$want" ]] || fail "${label}: expected ${want}, got ${got}"
}

expect "f" "bind with a foreign token must fail" \
  "SELECT public.bind_checkout_session('${test_user}'::uuid, gen_random_uuid(), 'cs_pr234_race_a', clock_timestamp() + interval '30 minutes')"
expect "t" "bind with the owner token must succeed" \
  "SELECT public.bind_checkout_session('${test_user}'::uuid, '${winner_token}'::uuid, 'cs_pr234_race_a', clock_timestamp() + interval '30 minutes')"
expect "f" "a second bind must fail" \
  "SELECT public.bind_checkout_session('${test_user}'::uuid, '${winner_token}'::uuid, 'cs_pr234_race_b', clock_timestamp() + interval '30 minutes')"
expect "f" "release with a foreign token must fail" \
  "SELECT public.release_checkout_lock('${test_user}'::uuid, NULL, gen_random_uuid())"
expect "f" "release by an unbound session id must fail" \
  "SELECT public.release_checkout_lock('${test_user}'::uuid, 'cs_not_bound', NULL)"
expect "t" "release by the bound session id must succeed" \
  "SELECT public.release_checkout_lock('${test_user}'::uuid, 'cs_pr234_race_a', NULL)"
echo "ok 2: bind and release are owner-scoped and session-exact"

# A delayed webhook must not release a newer checkout's lock.
expect "t" "a new owner can acquire after release" \
  "SELECT acquired FROM public.try_acquire_checkout_lock('${test_user}'::uuid, 900)"
expect "f" "a stale session id must not release the new lock" \
  "SELECT public.release_checkout_lock('${test_user}'::uuid, 'cs_pr234_race_a', NULL)"
echo "ok 3: a delayed completion cannot release a newer lock"

# ---------------------------------------------------------------------------
# 3. Webhook claim: two concurrent deliveries of one event id.
# ---------------------------------------------------------------------------
cat >"${tmp}/claim-race.sql" <<SQL
BEGIN;
SELECT pg_sleep(0.2);
SELECT outcome || '|' || COALESCE(token::text, '-')
FROM public.claim_stripe_webhook_event('${event_prefix}_claim', 'invoice.payment_succeeded', 300);
SELECT pg_sleep(0.4);
COMMIT;
SQL

race "claim-race" "${tmp}/claim-race.sql"

claimed="$(cat "${tmp}/claim-race.1" "${tmp}/claim-race.2" | grep -c '^claimed|' || true)"
in_flight="$(cat "${tmp}/claim-race.1" "${tmp}/claim-race.2" | grep -c '^in_flight|-$' || true)"
[[ "$claimed" == "1" ]] || { cat "${tmp}/claim-race.1" "${tmp}/claim-race.2" >&2; fail "claim race produced ${claimed} claims"; }
[[ "$in_flight" == "1" ]] || { cat "${tmp}/claim-race.1" "${tmp}/claim-race.2" >&2; fail "claim race produced ${in_flight} in_flight outcomes"; }
echo "ok 4: exactly one of two concurrent deliveries claimed the event"

# ---------------------------------------------------------------------------
# 4. Stale claim: the reclaimer wins and the old token cannot write.
# ---------------------------------------------------------------------------
old_token="$(psql_exec -c "SELECT COALESCE(token::text,'-') FROM public.claim_stripe_webhook_event('${event_prefix}_stale', 'invoice.payment_failed', 1)" | tail -1)"
[[ "$old_token" != "-" ]] || fail "stale-claim setup: first claim failed"
sleep 1.3
new_out="$(psql_exec -c "SELECT outcome || '|' || COALESCE(token::text,'-') FROM public.claim_stripe_webhook_event('${event_prefix}_stale', 'invoice.payment_failed', 300)" | tail -1)"
[[ "$new_out" == claimed\|* ]] || fail "stale-claim: reclaimer did not win (${new_out})"
new_token="$(printf '%s' "$new_out" | cut -d'|' -f2)"

if psql_exec -c "SELECT public.assert_active_stripe_claim('${event_prefix}_stale', '${old_token}'::uuid)" >"${tmp}/stale.out" 2>&1; then
  fail "stale claim token was still accepted"
fi
grep -q 'stale or superseded' "${tmp}/stale.out" || { cat "${tmp}/stale.out" >&2; fail "stale claim failed for the wrong reason"; }
psql_exec -c "SELECT public.assert_active_stripe_claim('${event_prefix}_stale', '${new_token}'::uuid)" >/dev/null \
  || fail "the reclaimer's token did not pass the fence"
echo "ok 5: the reclaimer wins and the stale token is rejected"

# ---------------------------------------------------------------------------
# 5. Processed events are duplicates; expired checkout locks are stealable.
# ---------------------------------------------------------------------------
psql_exec -c "UPDATE public.stripe_webhook_events SET status = 'processed' WHERE event_id = '${event_prefix}_stale'" >/dev/null
expect "duplicate|-" "a processed event must report duplicate" \
  "SELECT outcome || '|' || COALESCE(token::text, '-') FROM public.claim_stripe_webhook_event('${event_prefix}_stale', 'invoice.payment_failed', 300)"

psql_exec -c "DELETE FROM public.stripe_checkout_locks WHERE user_id = '${test_user}'" >/dev/null
present="$(psql_exec -c "SELECT acquired FROM public.try_acquire_checkout_lock('${test_user}'::uuid, 1)" | tail -1)"
[[ "$present" == "t" ]] || fail "expired-lock setup: first acquisition failed"
sleep 1.3
stolen="$(psql_exec -c "SELECT acquired FROM public.try_acquire_checkout_lock('${test_user}'::uuid, 900)" | tail -1)"
[[ "$stolen" == "t" ]] || fail "an expired lock was not stealable"
echo "ok 6: processed events are duplicates and expired locks are stealable"

echo "all two-session race checks passed"
