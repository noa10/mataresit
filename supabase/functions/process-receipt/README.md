# Process Receipt Edge Function

This Edge Function processes receipt images using OCR and AI enhancement.

## Logging

This function uses the unified ProcessingLogger from `supabase/functions/_shared/db-logger.ts` which provides:

- Resilient error handling that never crashes the parent function
- Automatic fallback to console logging if database logging fails
- Service role key authentication to avoid RLS issues
- Consistent logging format across all edge functions

## Deployment

Deploy the function using:

```bash
# From the project root directory
supabase functions deploy process-receipt
```

## Architecture

The function follows a modular pipeline approach:

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
