CREATE INDEX IF NOT EXISTS idx_receipts_team_created_id
  ON public.receipts (team_id, created_at, id)
  WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receipts_user_created_id
  ON public.receipts (user_id, created_at, id)
  WHERE team_id IS NULL;
