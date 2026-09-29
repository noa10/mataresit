# src/services AGENTS.md

## OVERVIEW
Business logic & API service layer. 68 files, several exceeding 1500 lines. Core domain: receipts, teams, notifications, search, billing.

## STRUCTURE
```
src/services/
├── receiptService.ts           # 3253 lines — receipt CRUD, pagination, AI processing
├── notificationService.ts      # 2600 lines — alerts, in-app notifications, push
├── enhancedTeamService.ts      # 1823 lines — team management, roles, claims
├── teamService.ts              # 1512 lines — legacy team operations
├── embeddingMetricsService.ts  # Vector embedding analytics
├── categoryService.ts          # Expense categorization
├── profileService.ts           # User profile & account
├── receiptNotificationService.ts # Receipt-specific notifications
├── optimized-background-search-service.ts # Background search worker
├── realTimeMetricsCollector.ts # Metrics aggregation
├── queueMetricsService.ts      # Queue system metrics
├── avatarService.ts            # User avatar management
├── teamApiService.ts           # Team API wrapper
└── apiProxy.ts                 # Request interception/logging
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Receipt CRUD / upload | `receiptService.ts` | Large file — search for `createReceipt`, `processReceiptImage` |
| Pagination | `receiptService.ts` | `fetchReceiptsPage`, `getPaginationInfo` |
| Team creation / invites | `enhancedTeamService.ts` | `createTeam`, `sendTeamInvitation` |
| Claims workflow | `enhancedTeamService.ts` | `submitClaim`, `approveClaim` |
| Notifications / alerts | `notificationService.ts` | `sendAlert`, `sendPushNotification` |
| Expense categories | `categoryService.ts` | `getCategories`, `createCategory` |
| User profile | `profileService.ts` | `getProfile`, `updateProfile` |
| Search / embeddings | `optimized-background-search-service.ts` | Background + real-time search |
| Billing / subscriptions | Use Stripe context + `supabase/functions/stripe-webhook/` | Webhook handler in Edge Functions |

## CONVENTIONS

- **Service functions return typed objects** — Never return raw Supabase responses. Always map to domain types from `src/types/`.
- **Error pattern**: `try { ... } catch (error) { console.error("...", error); toast.error("..."); return null; }`
- **Pagination**: All list endpoints accept `{ page, pageSize, filters? }` and return `{ data, pagination: { total, page, pageSize, totalPages } }`.
- **Supabase client**: Import from `@/integrations/supabase/client` — never instantiate a new client.
- **12 stub methods in `enhancedTeamService.ts`** (~line 1262) return placeholder data. Marked with TODO. Do not rely on them for production logic.

## ANTI-PATTERNS

- `console.log/error` used extensively for debug tracing — acceptable here, but do not add new ones unnecessarily.
- Hardcoded exchange rate `4.75` in `src/lib/receipts/validation.ts` — TODO to use live API.
- `profileService.ts` line 249: account deletion is a stub returning success without actual deletion.
