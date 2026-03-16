# Mataresit OpenClaw Skill

This package contains the implemented OpenClaw skill for Mataresit's current external API v1 chat surface. It ships an ESM entrypoint (`index.mjs`), an OpenClaw manifest (`skill.yaml`), and focused Vitest coverage for auth/config resolution, prompt routing, and chat-friendly response formatting.

## Package Layout

- `skill.yaml` - OpenClaw manifest with required env vars and the `openclaw` platform entry
- `index.mjs` - skill factory, authenticated API client, prompt detection, and v1 response handlers
- `package.json` - package metadata plus the local `npm test` script
- `vitest.config.mjs` - package-local Vitest config targeting `test/index.test.mjs`
- `test/index.test.mjs` - focused coverage for the shipped v1 flows

## Runtime Requirements

- Node `>=20`
- An OpenClaw-compatible host that can load `entry.openclaw: index.mjs`
- A reachable Mataresit external API v1 base URL

## Required Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MATARESIT_API_BASE_URL` | Yes | Full Mataresit external API base URL, for example `https://<project-ref>.supabase.co/functions/v1/external-api/api/v1` |
| `MATARESIT_API_KEY` | Yes | Mataresit API key sent through `X-API-Key`. The backend expects an `mk_test_...` or `mk_live_...` key with the scopes needed for the flow you want to expose. |
| `MATARESIT_SUPABASE_ACCESS_TOKEN` | Yes | Supabase user access token sent through `Authorization: Bearer <token>`. The backend validates that this bearer token belongs to the same user as the API key. |

## Finalized Auth Contract

Every request from this skill sends both authentication headers:

- `Authorization: Bearer <Supabase user access token>`
- `X-API-Key: <mk_test_... | mk_live_...>`

The external API returns `401` when either header is missing, when the authorization header is not bearer-formatted, when the API key is invalid, or when the bearer token user does not match the API key owner.

## Supported v1 Prompt Flows

The manifest advertises these top-level OpenClaw skills:

- `quick-receipt`
- `receipt-lookup`
- `claims`
- `profile`
- `categories`
- `gamification`
- `team-insights`

Within those skills, the runtime currently handles these prompt families:

| Prompt family | Backing routes | Required scope(s) |
| --- | --- | --- |
| Quick receipt entry | `POST /receipts/quick` | `receipts:write` |
| Spending summary | `GET /analytics/summary` | `analytics:read` |
| Spending by category | `GET /analytics/categories` | `analytics:read` |
| Receipt lookup by ID/list/search | `GET /receipts/:receiptId`, `GET /receipts`, `POST /search` | `receipts:read`, `search:read` |
| Claim create/list/update/submit | `POST /claims`, `GET /claims`, `PATCH /claims/:claimId` | `claims:read`, `claims:write`, `teams:read` for team resolution |
| Profile/account checks | `GET /me` | `profile:read` |
| Category lookup | `GET /categories` and optional `GET /teams` for team resolution | `categories:read`, `teams:read` when team-specific |
| Gamification profile | `GET /gamification/profile` | `gamification:read` |
| Leaderboards | `GET /gamification/leaderboard` | `gamification:read` |
| Team spending insights | `GET /teams`, `GET /teams/:teamId/stats` | `teams:read` |

### Example Prompts

- `Add a receipt from Quick Stop for RM 12.50`
- `How much did I spend this month?`
- `Show my spending by category this month`
- `Find my Starbucks receipt from last month`
- `Create a claim "Client travel" for RM 82.40 for team Finance`
- `Update claim 11111111-1111-4111-8111-111111111111 to RM 90`
- `Submit claim 11111111-1111-4111-8111-111111111111`
- `Show my profile`
- `Show categories for team Finance`
- `What is my XP and level?`
- `Show the Malaysia leaderboard for deductible spending`
- `How is team Finance spending this month?`

## Behavior Notes

- Quick receipt defaults are applied automatically when omitted: `date=today`, `currency=MYR`, and `status=unreviewed`
- User-facing amounts are formatted in MYR-friendly output by default
- Unsupported prompts return explicit fallback guidance with example prompts instead of silent failure
- Team-aware claim/category/team-insight flows resolve team IDs through `GET /teams`; if the user belongs to multiple teams, the prompt should include the team name

## Local Verification

From the repository root:

- `npm --prefix mataresit-skill test`
- `npx vitest run --config mataresit-skill/vitest.config.mjs`

From inside `mataresit-skill/`:

- `npm test`

The package-local Vitest config runs `test/index.test.mjs`, which covers config validation, authenticated request construction, intent routing, and response formatting for the shipped v1 flows.

## Deployment and Platform Connection Notes

- `skill.yaml` declares `entry.openclaw: index.mjs` and `platforms.openclaw: true`; this package is ready to be loaded by an OpenClaw-compatible runtime
- The package itself does not provision OpenClaw, Supabase, or chat-platform connectors; deploy it into your chosen OpenClaw host and inject the three required env vars there
- `MATARESIT_API_BASE_URL` must point at a deployed Mataresit external API v1 surface that already includes the `/me`, `/categories`, `/gamification/*`, `/analytics/*`, `/claims`, `/receipts`, `/search`, and `/teams` handlers used here
- WhatsApp, Telegram, Discord, Slack, or other platform wiring remains outside this repository/task scope; the current package only defines the OpenClaw skill entrypoint

## Known Limitations / Deferred Items

- There is no bundled local OpenClaw runtime harness in this repository; verification here is package-level via Vitest
- Prompt routing is deterministic and regex-based, so unsupported phrasing falls back to help text rather than using a model-driven parser
- Spending analytics depend on backend plan gating; when the external API returns a subscription-gated analytics error, the skill reports that limitation back to the user
- This package does not manage API-key creation, Supabase sign-in, or production platform secrets; operators must provide valid credentials and runtime configuration separately