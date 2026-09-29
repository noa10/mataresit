# Process Receipt Edge Function

The `process-receipt` Edge Function processes an uploaded receipt image through Mataresit's AI vision pipeline.

## Processing flow

1. Validate the request and receipt identifier.
2. Fetch and optimize the uploaded image.
3. Send the image to `enhance-receipt-data` for structured extraction.
4. Generate a thumbnail for list and preview views.
5. Save the extracted receipt data and processing status.
6. Queue or trigger embedding generation for search.
7. Allow database triggers and notification helpers to publish status updates.

The primary extraction path is AI vision-based. Traditional OCR-first processing is not the default path for this function.

## Provider configuration

AI provider credentials are read from server-side environment variables. Gemini is the primary configured path; other providers may be available through the provider-routing layer. Never place provider secrets in frontend `VITE_` variables or commit them to the repository.

## Local safety

Use an isolated local Supabase project for development. Do not run local reset, migration, or Edge Function deployment commands against a shared or production project.

## Deployment

Deploy the function from the repository root with the Supabase CLI after the required project configuration and secrets are in place:

```bash
supabase functions deploy process-receipt
```

The deployment must also include any functions and shared configuration required by the receipt-processing pipeline.
