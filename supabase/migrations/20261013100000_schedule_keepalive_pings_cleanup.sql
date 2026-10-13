-- Migration: 20261013100000_schedule_keepalive_pings_cleanup.sql
--
-- Monthly retention job for the keepalive ledger introduced by
-- 20261012000000_create_keepalive_pings.sql. That migration ships
-- public.cleanup_keepalive_pings() but nothing called it, so the ledger would
-- grow forever. Schedule it at 04:00 UTC on the 1st of each month.
--
-- Idempotent: scheduling is skipped when the job already exists, so this file
-- is safe to re-apply (e.g. `supabase db push --include-all`).
--
-- pg_cron is platform-managed on Supabase (it lives in the extensions schema);
-- the extension is deliberately NOT created here — same convention as
-- 20250717000002_setup_embedding_metrics_cron.sql. If pg_cron is not enabled,
-- this migration fails loudly rather than silently doing nothing.

-- Resolve `cron.*` regardless of the connection's default search_path. The
-- SET LOCAL is scoped to this migration's transaction only.
SET LOCAL search_path = public, extensions, pg_catalog;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-keepalive-pings'
  ) THEN
    RAISE NOTICE 'cleanup-keepalive-pings already scheduled — skipping';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'cleanup-keepalive-pings',                              -- job name
    '0 4 1 * *',                                            -- 04:00 UTC on the 1st, monthly
    $cron$SELECT public.cleanup_keepalive_pings();$cron$    -- command
  );

  RAISE NOTICE 'Scheduled cleanup-keepalive-pings (monthly, 04:00 UTC)';
END $$;
