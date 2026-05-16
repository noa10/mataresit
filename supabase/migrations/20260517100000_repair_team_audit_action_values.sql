-- Fill in team_audit_action enum values that were never added.
-- The base enum was created by 20250722000001 with 18 values, but later
-- migrations (20250722010000 user removal system, 20250722040000+ bulk
-- ops, 20250822000000 invitation flow) reference additional labels that
-- were skipped along with those migrations' other objects.
--
-- Symptom: detect_user_invitation_state throws 22P02
--   "invalid input value for enum team_audit_action: 'invitation_accessed'"
-- because it logs an audit row when an invite link is opened.
--
-- ALTER TYPE ADD VALUE IF NOT EXISTS is idempotent and re-runnable.
ALTER TYPE public.team_audit_action ADD VALUE IF NOT EXISTS 'invitation_accessed';
ALTER TYPE public.team_audit_action ADD VALUE IF NOT EXISTS 'bulk_invitation';
ALTER TYPE public.team_audit_action ADD VALUE IF NOT EXISTS 'bulk_member_removal';
ALTER TYPE public.team_audit_action ADD VALUE IF NOT EXISTS 'bulk_operation_cancelled';
ALTER TYPE public.team_audit_action ADD VALUE IF NOT EXISTS 'bulk_operation_retried';
ALTER TYPE public.team_audit_action ADD VALUE IF NOT EXISTS 'bulk_permission_updated';
ALTER TYPE public.team_audit_action ADD VALUE IF NOT EXISTS 'bulk_role_update';
ALTER TYPE public.team_audit_action ADD VALUE IF NOT EXISTS 'member_removal_cancelled';
ALTER TYPE public.team_audit_action ADD VALUE IF NOT EXISTS 'member_removal_scheduled';
ALTER TYPE public.team_audit_action ADD VALUE IF NOT EXISTS 'member_role_updated';
ALTER TYPE public.team_audit_action ADD VALUE IF NOT EXISTS 'member_sessions_invalidated';
ALTER TYPE public.team_audit_action ADD VALUE IF NOT EXISTS 'operation_cancelled';
ALTER TYPE public.team_audit_action ADD VALUE IF NOT EXISTS 'operation_rescheduled';
ALTER TYPE public.team_audit_action ADD VALUE IF NOT EXISTS 'operation_scheduled';
