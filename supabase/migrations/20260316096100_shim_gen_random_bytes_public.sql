-- Shim gen_random_bytes into public schema so SECURITY DEFINER functions can access it

CREATE OR REPLACE FUNCTION public.gen_random_bytes(p_length integer)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT extensions.gen_random_bytes(p_length);
$$;
