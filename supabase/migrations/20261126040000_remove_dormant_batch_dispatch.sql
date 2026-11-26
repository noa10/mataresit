-- Remove the dormant legacy batch dispatch path.
--
-- 20261104000001_batch_item_vault_trigger.sql introduced
-- public.batch_item_dispatch_config and public.handle_new_batch_item() for a
-- legacy process-batch-item Edge Function. That path never ran in production:
-- no trigger invokes the function, the config table has never held a row, and
-- the tables it would process (batches / batch_items) do not exist in the
-- project. The current batch upload path writes batch_upload_sessions /
-- batch_upload_files (20250720000003_batch_upload_optimization.sql) and posts
-- each file to process-receipt.
--
-- The deployed process-batch-item function is an untracked orphan with
-- verify_jwt disabled. It never validates the credential this function sends,
-- so the dispatch path adds an unauthenticated processing endpoint without
-- providing authentication. Removing it is the security-preserving choice.
--
-- This migration also removes the only database consumer of the Vault
-- service_role_key secret. The secret is deliberately left in Vault: deleting
-- it is a separate operator action after confirming no other consumer needs
-- it. Do not rotate it as part of this cleanup.
--
-- DROP FUNCTION fails if an untracked trigger still depends on the function.
-- That is deliberate: inspect and drop any such trigger first rather than
-- cascading silently.

BEGIN;

DROP FUNCTION IF EXISTS public.handle_new_batch_item();
DROP TABLE IF EXISTS public.batch_item_dispatch_config;

COMMIT;
