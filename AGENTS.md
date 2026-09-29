# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-25

## OVERVIEW

Mataresit — AI-powered receipt processing & expense management. React 18 + TypeScript + Vite 8 frontend, Supabase (PostgreSQL + Deno Edge Functions) backend, deployed on Vercel.

## STRUCTURE

```
./
├── src/
│   ├── components/ui/    # shadcn/ui primitive components (57 files)
│   ├── components/admin/ # Admin dashboard components
│   ├── hooks/            # Custom React hooks (46 files)
│   ├── lib/              # Utilities, shared logic, i18n, theme, AI (46 files)
│   ├── pages/            # Route pages, lazy-loaded (39 files)
│   ├── services/         # Business logic & API calls (68 files, several 1K+ lines)
│   ├── contexts/         # React context providers (16 nested in App.tsx)
│   └── types/            # TypeScript type definitions
├── supabase/
│   ├── functions/        # 35+ Deno Edge Functions
│   └── migrations/       # 300+ SQL migration files
├── tests/                # Vitest + Playwright test suites
│   ├── alerting/         # Alerting system tests
│   ├── queue/            # Queue system tests
│   └── phase4-integration/ # Cross-system integration tests
├── scripts/              # Build, deployment, monitoring, recovery utilities
└── docs/                 # Comprehensive documentation
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add a UI component | `src/components/ui/` | shadcn/ui pattern, use `cn()` for classes |
| Add a page/route | `src/pages/` | Export from `App.tsx` router, lazy-load heavy pages |
| Add business logic | `src/services/` | Use `@/` imports, return typed objects |
| Add a custom hook | `src/hooks/` | Prefix with `use`, co-locate tests in `__tests__/` |
| Add Supabase function | `supabase/functions/{name}/index.ts` | Deno runtime, use `_shared/` helpers |
| Add DB migration | `supabase/migrations/YYYYMMDDHHMMSS_name.sql` | Validated in CI |
| Add i18n strings | `src/locales/{en,ms}/` | Hierarchical keys: `common.buttons.save` |
| Fix test failure | `src/**/__tests__/` or `tests/{domain}/` | See test commands below |
| Debug build | `vite.config.ts` | Manual chunk splitting defined here |
| Update theme tokens | `src/index.css` | Tailwind v4 `@theme` block |

## CONVENTIONS (Deviations from Standard)

- **TypeScript `strict: false`** — Deliberate choice for this large codebase. `noImplicitAny`, `strictNullChecks`, `noUnusedLocals` all OFF. Only `tsconfig.node.json` uses strict mode.
- **ESLint flat config only** — `eslint.config.js`. No Prettier, no Biome. `@typescript-eslint/no-unused-vars` is OFF.
- **No barrel `index.ts` files anywhere** — All imports use explicit file paths. No exceptions.
- **Path alias `@/`** — Maps to `./src/`. Use for ALL internal imports. Never relative `../` imports across module boundaries.
- **Import order** — React → external libraries → contexts/hooks (`@/contexts/*`, `@/hooks/*`) → UI (`@/components/ui/*`) → services (`@/services/*`) → types with `type` keyword.
- **Tailwind CSS v4 CSS-first** — No `tailwind.config.ts`. Theme tokens in `src/index.css` `@theme {}` block. Custom `@utility` classes: `glass-card`, `receipt-container`.
- **Vite 8 + SWC** — `@vitejs/plugin-react-swc`, `oxc` minifier. Manual chunk splitting: vendor-react, vendor-ui, vendor-charts, i18n-en, i18n-ms, feature-admin, feature-settings, etc.
- **React Context + `useReducer`** — For complex state. NOT Redux, NOT Zustand. 16 nested providers in `App.tsx`.
- **TanStack Query v5** — Server state only. 5-min stale time. Cache invalidation via `CacheInvalidationService`.
- **i18next hierarchical keys** — `common.buttons.save`, `dashboard.receipts.upload_success`. English (`en/`) + Malay (`ms/`).
- **Currency default MYR** — Malaysian Ringgit. DD/MM/YYYY date format.
- **Naming** — Components PascalCase (`ReceiptCard.tsx`), hooks camelCase `useX`, services camelCase, contexts PascalCase + `Context` suffix.

## ANTI-PATTERNS (THIS PROJECT)

### Hard Forbidden
1. **Never manually edit `package.json`** — Use `npm install` only. Manual edits cause version conflicts.
2. **Never create multiple Supabase client instances** — Breaks auth state. Always use `supabase` from `@/integrations/supabase/client`.
3. **Never access production DB directly during development** — Production project ID: `mpmkbtsufihzdelrlszs`.
4. **Never reset or modify the remote production database** — Use migrations + `supabase db push`.

### Systemic (Known & Accepted)
- TypeScript strict mode is disabled codebase-wide — `as any`, `catch (error: any)`, non-null `!` assertions are common. Don't "fix" these unless asked.
- `no-console` ESLint rule is missing — 60+ `console.log/error` calls in production services. Acceptable here.
- `@typescript-eslint/no-explicit-any` is not enforced — 30+ `as any` casts exist, mostly in tests.

### Deprecated — Do Not Use
- `semanticSearch()` in `src/lib/ai-search.ts` → Use `unified-search` Edge Function.
- `extractTextractData()` / `mergeTextractAndAIData()` in `supabase/functions/process-receipt/index.ts` → AI-only processing.
- `useNotificationPreferences()` in `src/hooks/usePushNotifications.ts` → `useNotifications().preferences`.
- Theme utilities in `src/lib/theme.ts` → `ThemeContext` + `useTheme` hook.

### Stub/Placeholder Code (Do Not Rely On)
- 30+ TODO stubs with hardcoded values: `subscriptionTier="free"`, `billingInterval: 'monthly'`, `createdBy: 'api-user'`, `acknowledged_by: 'admin'`, `storageUsedMB = 0`, hardcoded exchange rate 4.75.
- 12 stub methods in `enhancedTeamService.ts` (lines ~1262) return zeros/placeholders.

## UNIQUE STYLES

- **shadcn/ui components** — Stored in `src/components/ui/`. Built on Radix UI primitives + Tailwind. HSL CSS variables for theming. `cn()` from `@/lib/utils` for conditional classes.
- **Deno Edge Functions** — 35+ functions in `supabase/functions/`. Each has `index.ts` entry. Shared helpers in `_shared/` (supabase-client, cors, stripe-config, api-auth, error-handling, rate-limiting, etc.). CI validates with `deno fmt --check`.
- **Dual Vitest configs** — `vitest.config.ts` (all tests, 3 setup files) and `vitest.unit.config.ts` (unit-only, excludes 14 integration-heavy files).
- **No Docker, no Kubernetes** — Pure serverless: Vercel (frontend) + Supabase (backend). The `.github/config/ci-cd-config.yaml` references Docker/K8s patterns that are NOT used.
- **GitNexus indexed** — 10101 symbols, 29268 relationships. Use `npx gitnexus analyze` if index is stale.

## COMMANDS

```bash
# Development
npm run dev              # Vite dev server (port 5173, host ::)
npm run build            # Production build (oxc minified)
npm run preview          # Preview production build locally

# Code Quality
npm run lint             # ESLint flat config

# Testing
npm run test             # All Vitest tests
npm run test:unit        # Unit tests only (vitest.unit.config.ts)
npm run test:integration # Integration tests
npm run test:alerting:*  # Alerting domain tests (unit/integration/e2e/performance/db)
npm run test:queue:*     # Queue domain tests
npm run test:phase4:*    # Phase4 cross-system tests

# Supabase
npm run supabase:push    # Push migrations to remote
npm run supabase:diff    # Schema diff
npm run supabase:migrate:new -- name

# Environment
npm run env:local        # Switch to local Supabase env
npm run env:production   # Switch to production env
npm run dev:local        # env:local + dev server
npm run dev:production   # env:production + dev server

# Deployment
npm run deploy:stage2:frontend      # Build + mark ready
npm run deploy:verify:complete      # Post-deployment validation
npm run deploy:validate:malaysian   # Pre-deployment Malaysian features check
```

## NOTES

- **Supabase migration history is synced** — 302 migrations. `supabase db push` works. If drift occurs: `supabase migration repair <version> --status applied`.
- **React 19 pinned, ignored by Dependabot** — Requires dedicated migration effort. Do not upgrade React casually.
- **Vercel SPA rewrites** — All routes `/*` → `/index.html`. Special handling for `/docs/*`.
- **Edge Functions use Deno, not Node** — Do not use Node.js APIs in `supabase/functions/`. Use Deno standard library.
- **CI `continue-on-error: true`** — ESLint, TypeScript, security audit steps do not fail fast. Failures are aggregated in a final `deployment-gate` job.
- **Slack notifications disabled** — All workflows use GitHub step summaries instead.
- **IPv6 dev server** — Vite configured with `host: "::"`.
- **Playwright MCP in dependencies** — `@playwright/mcp` is in `dependencies` (not devDependencies).
- **xlsx from CDN** — `xlsx` package installed from SheetJS CDN URL, not npm registry.
