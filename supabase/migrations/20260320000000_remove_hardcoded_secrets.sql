-- Historical migration: the original replacement embedded another service-role
-- credential. Its literal is redacted here, but may remain in Git history and
-- previously deployed databases; treat it as compromised and rotate or revoke it.
-- This edit alone does not remediate any existing deployment.
--
-- The raising stub prevents a replay from reintroducing the credential.
-- 20261104000001_batch_item_vault_trigger.sql replaces the function with
-- Vault-backed dispatch and an administrator-controlled endpoint.

CREATE OR REPLACE FUNCTION public.handle_new_batch_item()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION
    'handle_new_batch_item requires Vault-backed configuration; see 20261104000001_batch_item_vault_trigger.sql';
END;
$function$;
