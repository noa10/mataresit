-- Test-only pg_net stub. The billing suites never dispatch an HTTP request;
-- they only require the extension to exist and net.http_post to be callable.
CREATE SCHEMA IF NOT EXISTS net;

CREATE OR REPLACE FUNCTION net.http_post(
  url text,
  headers jsonb DEFAULT '{}'::jsonb,
  body jsonb DEFAULT '{}'::jsonb,
  timeout_milliseconds integer DEFAULT 5000
) RETURNS bigint
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'pg_net test stub: network delivery is disabled';
END;
$function$;
