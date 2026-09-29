# supabase/functions/_shared AGENTS.md

## OVERVIEW
Shared library for Supabase Edge Functions — 41 Deno modules. Common utilities: auth, CORS, Stripe config, API error handling, rate limiting, logging, AI routing.

## STRUCTURE
```
supabase/functions/_shared/
├── supabase-client.ts          # Supabase client factory (Deno runtime)
├── cors.ts                     # CORS headers for all functions
├── stripe-config.ts            # Price-to-tier mapping, subscription plans
├── api-auth.ts                 # API key authentication
├── api-error-handling.ts       # Standard error response format
├── api-rate-limiting.ts        # Per-key rate limiting
├── db-logger.ts                # Structured DB logging
├── notification-helper.ts      # In-app notification dispatch
├── vector-validation.ts        # Embedding vector dimension checks
├── embedding-quality-metrics.ts # Vector quality scoring
├── temporal-parser.ts          # Natural language date parsing
├── provider-routing.ts         # AI provider selection (Gemini vs Groq)
├── prompt-engineering.ts       # Receipt extraction prompts
├── content-synthesis.ts        # RAG response synthesis
├── enhanced-reranking.ts       # Search result reranking
├── edge-cache.ts               # Edge function response caching
├── dynamic-tool-system.ts      # Tool calling for AI functions
├── self-correction-system.ts   # AI response self-correction
├── response-generator.ts       # Structured response formatting
├── contextual-snippets.ts      # Context window management
├── ai-response-parsers.ts      # Gemini/Groq response parsing
├── external-api-handler.ts     # External API proxy
├── receipt-prompts.ts          # Receipt-specific prompts
├── smart-date-suggestions.ts   # Date inference from text
├── api-analytics.ts            # API usage analytics, hardcoded trend
├── api-subscription-enforcement.ts # Quota enforcement, hardcoded storageUsedMB=0
├── api-receipts.ts             # Receipt CRUD handlers
├── api-receipts-quick.ts       # Quick receipt operations
├── api-search.ts               # Search API handlers
├── api-teams.ts                # Team API handlers
├── api-claims.ts               # Claims API handlers
├── api-categories.ts           # Category API handlers
├── api-gamification.ts         # Gamification API handlers
├── api-me.ts                   # User profile API handlers
├── api-performance.ts          # Performance metrics API
├── gamification-streak-reminder.ts # Streak reminder logic
├── notification-preferences.ts # Notification settings
└── retired-api-alias.ts        # 410 GONE for deprecated endpoints
```

## CONVENTIONS

- **Deno runtime** — Use Deno standard library (`https://deno.land/std`). No Node.js APIs (`fs`, `path`, `http`).
- **Import from `_shared/`** — All functions import shared utilities via relative paths: `import { createClient } from '../_shared/supabase-client.ts'`.
- **Standard response shape** — `{ success: true, data: ... }` or `{ success: false, error: 'message' }`. Defined in `api-error-handling.ts`.
- **CORS headers on EVERY response** — Use `corsHeaders` from `cors.ts`.
- **JWT verification** — Supabase `config.toml` sets `verify_jwt = true` by default. Per-function overrides in `supabase/functions/config.toml`.
- **Rate limiting by API key** — `api-rate-limiting.ts` checks key quota before processing.

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add auth to new function | `api-auth.ts` | Check `x-api-key` header or Supabase JWT |
| Add Stripe billing | `stripe-config.ts` | Price-to-tier mapping. Update when adding plans |
| Add error handling | `api-error-handling.ts` | Use `createErrorResponse()`, `createSuccessResponse()` |
| Add rate limiting | `api-rate-limiting.ts` | Wrap handler with `checkRateLimit()` |
| Add logging | `db-logger.ts` | Structured logs to Supabase table |
| Add AI provider | `provider-routing.ts` | Route to Gemini or Groq based on model + cost |
| Add receipt prompt | `prompt-engineering.ts` / `receipt-prompts.ts` | Gemini prompt templates |
| Add search reranking | `enhanced-reranking.ts` | Hybrid score combining vector + keyword |
| Add caching | `edge-cache.ts` | Response caching with TTL |
| Deprecate endpoint | `retired-api-alias.ts` | Return 410 GONE with `external-api` redirect |

## ANTI-PATTERNS

- **Do NOT use Node.js APIs** — No `fs`, `path`, `process.env`. Use Deno equivalents (`Deno.env.get()`, `Deno.readFile()`).
- **Do NOT import from `src/`** — Edge Functions are completely separate from the frontend. Shared code lives ONLY in `_shared/`.
- **Hardcoded stub values** — `api-analytics.ts` line 316: `trend: 'stable'`; `api-subscription-enforcement.ts` line 112: `storageUsedMB = 0`. These are TODOs.
- **`retired-api-alias.ts`** — Old endpoints (`api-external`, `mataresit-api`) return 410. Do not revive them.
