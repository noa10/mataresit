-- Regression test: the dormant legacy batch dispatch path stays removed.
--
-- 20261126040000_remove_dormant_batch_dispatch.sql drops
-- public.batch_item_dispatch_config and public.handle_new_batch_item(). The
-- path never ran in production: no trigger invoked the function, the config
-- table never held a row, and no repo migration creates the batches /
-- batch_items tables it processed. The current batch upload path writes
-- batch_upload_sessions / batch_upload_files and calls process-receipt.
--
-- How to run: apply the migrations to a scratch PostgreSQL, then run:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/batch_item_dispatch_removed.sql
--
-- Read-only; safe to re-run.

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF to_regclass('public.batch_item_dispatch_config') IS NOT NULL THEN
    RAISE EXCEPTION 'batch_item_dispatch_config must stay removed';
  END IF;
END $$;

DO $$
DECLARE
  v_overloads INTEGER;
BEGIN
  SELECT count(*)
  INTO v_overloads
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'handle_new_batch_item';

  IF v_overloads <> 0 THEN
    RAISE EXCEPTION 'public.handle_new_batch_item() must stay removed; found % overload(s)', v_overloads;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosrc LIKE '%process-batch-item%'
  ) THEN
    RAISE EXCEPTION 'no public function may dispatch to process-batch-item';
  END IF;
END $$;
