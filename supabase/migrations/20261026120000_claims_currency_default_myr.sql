-- Claims are filed in Malaysian Ringgit across the app (receipts, pricing and
-- ledger all use MYR). The original schema defaulted the currency column and
-- the create_claim RPC to USD, so claims created without an explicit currency
-- rendered with a dollar sign. Align both with MYR and normalise legacy rows.

ALTER TABLE public.claims
  ALTER COLUMN currency SET DEFAULT 'MYR'::character varying;

-- Existing claims that still carry the old default were entered as ringgit
-- amounts in a MYR-only workflow; normalise them so they render as RM.
UPDATE public.claims
SET currency = 'MYR', updated_at = now()
WHERE currency = 'USD';

CREATE OR REPLACE FUNCTION public.create_claim(
  _team_id uuid,
  _title character varying,
  _description text,
  _amount numeric,
  _currency character varying,
  _category character varying,
  _priority claim_priority,
  _attachments jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  _claim_id UUID;
BEGIN
  -- Check if user can submit claims in this team
  IF NOT public.can_submit_claims(_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'Insufficient permissions to create claims in this team';
  END IF;

  -- Insert the claim
  INSERT INTO public.claims (
    team_id, claimant_id, title, description, amount, currency,
    category, priority, attachments
  ) VALUES (
    _team_id, auth.uid(), _title, _description, _amount,
    COALESCE(_currency, 'MYR'), _category, COALESCE(_priority, 'medium'),
    COALESCE(_attachments, '[]'::jsonb)
  ) RETURNING id INTO _claim_id;

  -- Create audit trail entry
  INSERT INTO public.claim_audit_trail (
    claim_id, user_id, action, new_status, comment
  ) VALUES (
    _claim_id, auth.uid(), 'created', 'draft', 'Claim created'
  );

  RETURN _claim_id;
END;
$function$;
