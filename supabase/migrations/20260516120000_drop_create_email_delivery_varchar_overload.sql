-- Resolve PGRST203 (function overload ambiguity) on create_email_delivery.
--
-- Two overloads exist that differ only by _related_entity_id type:
--   (..., _related_entity_id varchar, _team_id uuid, _metadata jsonb)
--   (..., _related_entity_id uuid,    _team_id uuid, _metadata jsonb)
-- All callers (send-email, send-team-invitation-email) pass a UUID string,
-- which PostgREST refuses to disambiguate. Email still sends but the
-- email_delivery row is never written, breaking delivery tracking.
--
-- Drop the legacy varchar overload; the uuid overload is the canonical one
-- and matches every current caller.
DROP FUNCTION IF EXISTS public.create_email_delivery(
  _recipient_email character varying,
  _subject character varying,
  _template_name character varying,
  _related_entity_type character varying,
  _related_entity_id character varying,
  _team_id uuid,
  _metadata jsonb
);
