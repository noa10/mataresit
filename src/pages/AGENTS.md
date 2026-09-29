# src/pages AGENTS.md

## OVERVIEW
Route pages — 39 files. React Router v7 with lazy loading. Auth guards via `ProtectedRoute` and `AdminRoute`.

## STRUCTURE
```
src/pages/
├── Index.tsx                   # Landing page (public)
├── Dashboard.tsx               # 1542 lines — main dashboard with analytics
├── ApiReferencePage.tsx        # 2660 lines — API documentation viewer
├── Auth.tsx                    # Login / signup / OAuth
├── SettingsPage.tsx            # User settings
├── PricingPage.tsx             # Subscription plans
├── SemanticSearch.tsx          # AI semantic search, TODO feedback storage
├── UnifiedSearchPage.tsx       # Hybrid search interface
├── ReceiptViewer.tsx           # 2304 lines — receipt detail + editor
├── AdminDashboard.tsx          # Admin analytics
├── AdminUsersPage.tsx          # User management
├── AdminSystemHealthPage.tsx   # System monitoring
├── AdminAlertsPage.tsx         # Alert configuration
├── TeamDashboard.tsx           # Team expense dashboard
├── TeamMembersPage.tsx         # Team member management
├── TeamInvitationsPage.tsx     # Pending invites
├── ClaimsPage.tsx              # Expense claims workflow
├── ReportsPage.tsx             # PDF / Excel report generation
├── UploadPage.tsx              # Receipt upload interface
├── DuplicateDetectionPage.tsx  # Find duplicate receipts
└── ...
```

## CONVENTIONS

- **Lazy load heavy pages** — `React.lazy(() => import('./Dashboard'))` + `Suspense` with `Skeleton` fallback.
- **Page components are default exports** — Router imports use default export.
- **Auth guards in `App.tsx`** — `ProtectedRoute` wraps authenticated pages. `AdminRoute` wraps admin pages, checks `user.role === 'admin'`.
- **Page-level data fetching** — Use `useQuery` hooks from `src/hooks/`. Do NOT fetch directly in pages.
- **Malaysian context** — Pages use `DD/MM/YYYY` dates, `MYR` currency, Malay (`ms`) and English (`en`) via `useTranslation()`.

## WHERE TO LOOK

| Route | Page | Notes |
|-------|------|-------|
| `/` | `Index.tsx` | Landing, marketing content |
| `/dashboard` | `Dashboard.tsx` | 1542 lines — receipts list, charts, stats |
| `/receipt/:id` | `ReceiptViewer.tsx` | 2304 lines — image + data side-by-side editor |
| `/search` | `SemanticSearch.tsx` | AI search, feedback storage TODO at line 927 |
| `/unified-search` | `UnifiedSearchPage.tsx` | Hybrid search, subscription context TODO at line 52 |
| `/settings` | `SettingsPage.tsx` | Profile, preferences, billing |
| `/pricing` | `PricingPage.tsx` | Stripe checkout integration |
| `/admin` | `AdminDashboard.tsx` | System health, user counts |
| `/admin/users` | `AdminUsersPage.tsx` | User table with role management |
| `/admin/alerts` | `AdminAlertsPage.tsx` | Alert rule configuration |
| `/team` | `TeamDashboard.tsx` | Team expenses, claims |
| `/team/members` | `TeamMembersPage.tsx` | Invite, roles, permissions |
| `/claims` | `ClaimsPage.tsx` | Submit/approve expense claims |
| `/reports` | `ReportsPage.tsx` | Generate PDF/Excel exports |
| `/upload` | `UploadPage.tsx` | Batch receipt upload |
| `/api-reference` | `ApiReferencePage.tsx` | 2660 lines — interactive API docs |

## ANTI-PATTERNS

- `SemanticSearch.tsx` line 927 — Feedback storage/analytics is a TODO stub.
- `UnifiedSearchPage.tsx` line 52 — Subscription tier fetched from hardcoded context instead of user subscription.
- `ApiReferencePage.tsx` is 2660 lines — consider splitting if adding features.
