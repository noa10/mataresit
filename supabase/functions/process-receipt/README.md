# Process Receipt Edge Function

This Edge Function processes receipt images using OCR and AI enhancement.

## Fixing Row-Level Security (RLS) Issues

The current implementation has an issue with the `processing_logs` table's row-level security policy, which prevents the function from logging processing steps to the database.

### How to Fix

1. Replace the current `db-logger.ts` file with the fixed version:

```bash
# From the project root directory
cp supabase/functions/process-receipt/shared/db-logger-fixed.ts supabase/functions/process-receipt/shared/db-logger.ts
```

2. Deploy the updated function:

```bash
# From the project root directory
supabase functions deploy process-receipt
```

### What Changed

The fixed version of the logger:

1. Gracefully handles RLS policy violations
2. Continues to log to the console even when database logging fails
3. Automatically disables database logging after the first RLS error
4. Never fails the main function due to logging errors

This ensures that receipt processing continues to work even when the database logging fails.

## Alternative Solution

If you prefer to fix the RLS policy instead, you can add a policy to the `processing_logs` table that allows the service role to insert rows:

```sql
-- Run this in the SQL editor in the Supabase dashboard
ALTER TABLE public.processing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert logs"
  ON public.processing_logs
  FOR INSERT
  TO service_role
  USING (true);
```

This would allow the Edge Function to log to the database while still protecting the table from unauthorized access.
