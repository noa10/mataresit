CREATE INDEX IF NOT EXISTS idx_receipts_team_date_created_id
  ON public.receipts (team_id, date, created_at, id)
  WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receipts_user_date_created_id
  ON public.receipts (user_id, date, created_at, id)
  WHERE team_id IS NULL;
