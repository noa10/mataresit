-- Update claim notification URLs to include specific claim IDs for direct navigation
-- This enhances the user experience by directing users to specific claim details

-- Fix approve_claim function to include claim ID in URL
CREATE OR REPLACE FUNCTION public.approve_claim(_claim_id uuid, _comment text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _claim_record public.claims;
BEGIN
  -- Get claim details
  SELECT * INTO _claim_record
  FROM public.claims
  WHERE id = _claim_id;

  -- Check if claim exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  -- Check if user has permission (must be team admin/owner)
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = _claim_record.team_id 
    AND tm.user_id = auth.uid() 
    AND tm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to approve claim';
  END IF;

  -- Check if claim can be approved
  IF _claim_record.status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'Claim cannot be approved in current status: %', _claim_record.status;
  END IF;

  -- Update claim status
  UPDATE public.claims 
  SET 
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = NOW(),
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = _claim_id;

  -- Create audit trail entry
  INSERT INTO public.claim_audit_trail (
    claim_id, user_id, action, old_status, new_status, comment
  ) VALUES (
    _claim_id, auth.uid(), 'approved', _claim_record.status, 'approved', _comment
  );

  -- Create notification for claimant with specific claim URL
  INSERT INTO public.notifications (
    recipient_id, team_id, type, priority, title, message, action_url,
    related_entity_type, related_entity_id
  ) VALUES (
    _claim_record.claimant_id, _claim_record.team_id, 'claim_approved', 'high',
    'Claim Approved',
    'Your claim "' || _claim_record.title || '" has been approved',
    '/claims/' || _claim_id,
    'claim', _claim_id
  );

  RETURN TRUE;
END;
$function$;

-- Fix reject_claim function to include claim ID in URL
CREATE OR REPLACE FUNCTION public.reject_claim(_claim_id uuid, _rejection_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _claim_record public.claims;
BEGIN
  -- Get claim details
  SELECT * INTO _claim_record
  FROM public.claims
  WHERE id = _claim_id;

  -- Check if claim exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  -- Check if user has permission (must be team admin/owner)
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = _claim_record.team_id 
    AND tm.user_id = auth.uid() 
    AND tm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to reject claim';
  END IF;

  -- Check if claim can be rejected
  IF _claim_record.status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'Claim cannot be rejected in current status: %', _claim_record.status;
  END IF;

  -- Update claim status
  UPDATE public.claims 
  SET 
    status = 'rejected',
    rejection_reason = _rejection_reason,
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = _claim_id;

  -- Create audit trail entry
  INSERT INTO public.claim_audit_trail (
    claim_id, user_id, action, old_status, new_status, comment
  ) VALUES (
    _claim_id, auth.uid(), 'rejected', _claim_record.status, 'rejected', _rejection_reason
  );

  -- Create notification for claimant with specific claim URL
  INSERT INTO public.notifications (
    recipient_id, team_id, type, priority, title, message, action_url,
    related_entity_type, related_entity_id
  ) VALUES (
    _claim_record.claimant_id, _claim_record.team_id, 'claim_rejected', 'high',
    'Claim Rejected',
    'Your claim "' || _claim_record.title || '" has been rejected: ' || _rejection_reason,
    '/claims/' || _claim_id,
    'claim', _claim_id
  );

  RETURN TRUE;
END;
$function$;

-- Fix submit_claim function to include claim ID in URL
CREATE OR REPLACE FUNCTION public.submit_claim(_claim_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _claim_record public.claims;
  _team_admins uuid[];
BEGIN
  -- Get claim details
  SELECT * INTO _claim_record
  FROM public.claims
  WHERE id = _claim_id;

  -- Check if claim exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  -- Check if user is the claimant or has permission
  IF _claim_record.claimant_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = _claim_record.team_id 
    AND tm.user_id = auth.uid() 
    AND tm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to submit claim';
  END IF;

  -- Check if claim can be submitted
  IF _claim_record.status != 'draft' THEN
    RAISE EXCEPTION 'Claim cannot be submitted in current status: %', _claim_record.status;
  END IF;

  -- Update claim status
  UPDATE public.claims 
  SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
  WHERE id = _claim_id;

  -- Create audit trail entry
  INSERT INTO public.claim_audit_trail (
    claim_id, user_id, action, old_status, new_status, comment
  ) VALUES (
    _claim_id, auth.uid(), 'submitted', 'draft', 'submitted', 'Claim submitted for review'
  );

  -- Get team admins for notifications
  SELECT ARRAY_AGG(tm.user_id) INTO _team_admins
  FROM public.team_members tm
  WHERE tm.team_id = _claim_record.team_id 
  AND tm.role IN ('owner', 'admin');

  -- Create notifications for team admins with specific claim URL
  INSERT INTO public.notifications (
    recipient_id, team_id, type, priority, title, message, action_url,
    related_entity_type, related_entity_id
  )
  SELECT 
    admin_id, _claim_record.team_id, 'claim_submitted', 'medium',
    'New Claim Submitted',
    'A new claim "' || _claim_record.title || '" has been submitted for review',
    '/claims/' || _claim_id,
    'claim', _claim_id
  FROM UNNEST(_team_admins) AS admin_id;

  RETURN TRUE;
END;
$function$;
