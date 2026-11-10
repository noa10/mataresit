#!/usr/bin/env bash
# Run the PR #234 Stripe/billing SQL regression suites on a disposable,
# loopback-only PostgreSQL container (default) or on an already-provisioned
# local Supabase stack (SUPABASE_DB_CONTAINER plus PR234_ALLOW_EXISTING=1).
#
# Default mode builds a curated, production-shaped schema:
#   bootstrap shims -> initial schema -> email shim -> subscription schema ->
#   profile insert policy -> billing schema -> the three PR migrations.
#
# Existing-container mode runs the suites only. It requires the explicit
# PR234_ALLOW_EXISTING=1 opt-in, refuses known protected project refs by name,
# and requires the pr234_verify_marker table that bootstrap.sql creates.
#
# PR234_POSTGRES_IMAGE overrides the disposable image; pin it by digest in an
# environment that requires reproducible base images.
#
# It never applies a migration to a remote database, never uses a hosted URL,
# and never prints a connection URL or secret value.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
scripts_dir="${repo_root}/.github/sql-regression"
migrations_dir="${repo_root}/supabase/migrations"
tests_dir="${repo_root}/supabase/tests"
log_dir="${PR234_SQL_LOG_DIR:-/tmp/pr234-sql-regression}"
container="${SUPABASE_DB_CONTAINER:-}"
suite_list=(
  stripe_webhook_claim_fencing
  payment_state_fencing
  stripe_checkout_locks
  stripe_fencing_regressions
  profile_billing_column_protection
  batch_item_dispatch_config
)

# The backend that owns the suites. This is intentionally an explicit list:
# invitation_acceptance_auth.sql has its own bare-Postgres CI job and a
# different schema contract.
curated_migrations=(
  20231126000000_initial_schema.sql
  20250115000000_add_subscription_schema.sql
  20250120000000_fix_profiles_insert_policy.sql
  20250722000000_enhance_billing_system_schema.sql
  20261103000000_restore_billing_schema_drift.sql
  20261104000000_stripe_production_hardening.sql
  20261104000001_batch_item_vault_trigger.sql
  20261106000000_stripe_checkout_locks_and_payment_fencing.sql
  20261110010000_stripe_fencing_regressions.sql
)

mkdir -p "$log_dir"
summary="${log_dir}/summary.tsv"
printf 'suite\texit\tfinished_utc\n' > "$summary"

refuse() {
  echo "refusing: $*" >&2
  exit 2
}

validate_container_target() {
  local name="$1"
  case "$name" in
    *oxtauhhixztusjlxcipo*|*mpmkbtsufihzdelrlszs*)
      refuse "container ${name} is a protected or unrelated stack"
      ;;
  esac
  if ! docker inspect "$name" >/dev/null 2>&1; then
    refuse "container ${name} does not exist"
  fi
}

psql_exec() {
  docker exec -i "$container" psql -X -h /var/run/postgresql -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"
}

require_marker() {
  local present
  present="$(psql_exec -tAc "SELECT to_regclass('public.pr234_verify_marker') IS NOT NULL")"
  if [[ "$present" != "t" ]]; then
    refuse "target has no pr234_verify_marker table; provision it with .github/sql-regression/bootstrap.sql"
  fi
}

run_file() {
  local label="$1" file="$2"
  echo "=== ${label} ===" | tee -a "${log_dir}/migrations.log"
  psql_exec -f - < "$file" 2>&1 | tee -a "${log_dir}/migrations.log"
}

wait_for_postgres() {
  local c="$1"
  for _ in $(seq 1 60); do
    if docker exec "$c" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "postgres did not become ready" >&2
  return 1
}

cleanup() {
  if [[ -n "${created_container:-}" ]]; then
    docker rm -f "$created_container" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ -n "$container" ]]; then
  if [[ "${PR234_ALLOW_EXISTING:-0}" != "1" ]]; then
    refuse "SUPABASE_DB_CONTAINER is set; re-run with PR234_ALLOW_EXISTING=1 to target a container you provisioned with .github/sql-regression/bootstrap.sql"
  fi
  validate_container_target "$container"
  mode="existing"
else
  if ! command -v docker >/dev/null 2>&1; then
    refuse "docker is required to create the disposable target"
  fi
  if ! docker image inspect "${PR234_POSTGRES_IMAGE:-postgres:15-alpine}" >/dev/null 2>&1; then
    echo "pulling ${PR234_POSTGRES_IMAGE:-postgres:15-alpine}" >&2
    docker pull "${PR234_POSTGRES_IMAGE:-postgres:15-alpine}" >/dev/null
  fi
  created_container="pr234-sql-$(date +%s)-$$"
  if docker inspect "$created_container" >/dev/null 2>&1; then
    refuse "temporary container ${created_container} already exists"
  fi
  echo "starting disposable ${created_container}" | tee -a "${log_dir}/provision.log"
  docker run -d --rm --name "$created_container" \
    --network none \
    -e POSTGRES_PASSWORD=postgres \
    --tmpfs /var/lib/postgresql/data:rw,size=1g \
    "${PR234_POSTGRES_IMAGE:-postgres:15-alpine}" >> "${log_dir}/provision.log"
  container="$created_container"
  wait_for_postgres "$container"
  sharedir="$(docker exec "$container" pg_config --sharedir)"
  docker cp "${scripts_dir}/pg_net/pg_net.control" \
    "${container}:${sharedir}/extension/pg_net.control"
  docker cp "${scripts_dir}/pg_net/pg_net--1.0.sql" \
    "${container}:${sharedir}/extension/pg_net--1.0.sql"
  mode="disposable"
fi

echo "target mode: ${mode}" | tee -a "${log_dir}/provision.log"
psql_exec -tAc "SELECT version()" | tee "${log_dir}/version.txt"

if [[ "$mode" == "disposable" ]]; then
  run_file "bootstrap" "${scripts_dir}/bootstrap.sql"
  run_file "initial schema" "${migrations_dir}/20231126000000_initial_schema.sql"
  run_file "profiles.email shim" "${scripts_dir}/email-column.sql"
  for migration in "${curated_migrations[@]:1}"; do
    run_file "$migration" "${migrations_dir}/${migration}"
  done
fi

require_marker

failed=0
for suite in "${suite_list[@]}"; do
  file="${tests_dir}/${suite}.sql"
  if [[ ! -f "$file" ]]; then
    echo "missing suite: ${file}" >&2
    failed=1
    printf '%s\t%s\t%s\n' "$suite" "missing" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$summary"
    continue
  fi
  echo "=== ${suite} ===" | tee -a "${log_dir}/${suite}.log"
  if psql_exec -f - < "$file" >> "${log_dir}/${suite}.log" 2>&1; then
    printf '%s\t%s\t%s\n' "$suite" "0" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$summary"
  else
    printf '%s\t%s\t%s\n' "$suite" "1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$summary"
    failed=1
    echo "FAIL ${suite}" >&2
    tail -20 "${log_dir}/${suite}.log" >&2
  fi
done

# The suites are single-session. Prove the primary-key / ON CONFLICT
# serialisation with two genuinely concurrent connections on the same target.
echo "=== two_session_races ===" | tee -a "${log_dir}/two_session_races.log"
if PR234_RACE_CONTAINER="$container" bash "${scripts_dir}/two-session-races.sh" \
     >> "${log_dir}/two_session_races.log" 2>&1; then
  printf '%s\t%s\t%s\n' "two_session_races" "0" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$summary"
else
  printf '%s\t%s\t%s\n' "two_session_races" "1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$summary"
  failed=1
  echo "FAIL two_session_races" >&2
  tail -20 "${log_dir}/two_session_races.log" >&2
fi

if [[ "$failed" -ne 0 ]]; then
  echo "one or more SQL regression suites failed; see ${log_dir}" >&2
  exit 1
fi

echo "all SQL regression suites passed; see ${log_dir}"
