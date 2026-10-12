-- ============================================================================
-- KEEPALIVE PINGS
-- Migration: 20261012000000_create_keepalive_pings.sql
-- Description: Activity ledger for the Supabase keepalive workflow.
--
-- Supabase pauses Free plan projects after ~7 days without sufficient user
-- database activity. The keepalive GitHub Actions workflow writes one row per
-- run into this table so there is a permanent, auditable record that the ping
-- actually reached the database (and when it last did).
--
-- Deliberately NOT upserted onto a single row: an append-only ledger lets you
-- see gaps in coverage, which is exactly the signal you want if the workflow
-- itself has been auto-disabled.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.keepalive_pings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.keepalive_pings IS
  'Append-only ledger of Supabase keepalive pings. Presence of a row within the last 7 days proves the project is receiving database activity.';

COMMENT ON COLUMN public.keepalive_pings.source IS
  'Which workflow wrote the row (e.g. supabase-keepalive).';
COMMENT ON COLUMN public.keepalive_pings.status IS
  'ok, or a short machine-readable outcome tag when the run detected a problem.';

-- The keepalive job authenticates with the service role key, which bypasses RLS.
-- RLS stays enabled with no policies so that anon/authenticated keys can neither
-- read nor write this table.
ALTER TABLE public.keepalive_pings ENABLE ROW LEVEL SECURITY;

-- Retention: keep 90 days of history. A monthly cleanup keeps the table tiny
-- while still leaving plenty of evidence for pause diagnostics.
CREATE OR REPLACE FUNCTION public.cleanup_keepalive_pings(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.keepalive_pings
  WHERE created_at < now() - make_interval(days => retention_days);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_keepalive_pings(INTEGER) IS
  'Deletes keepalive ping rows older than retention_days (default 90). Returns the number of rows removed.';

REVOKE ALL ON FUNCTION public.cleanup_keepalive_pings(INTEGER) FROM PUBLIC, anon, authenticated;

-- Newest-first lookup index used by the keepalive workflow to confirm its write.
CREATE INDEX IF NOT EXISTS idx_keepalive_pings_created_at
  ON public.keepalive_pings (created_at DESC);
