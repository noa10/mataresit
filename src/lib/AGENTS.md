# src/lib AGENTS.md

## OVERVIEW
Shared utilities, configuration, and core infrastructure. 46 files spanning i18n, theme, AI search, caching, validation, and browser compatibility.

## STRUCTURE
```
src/lib/
├── utils.ts                    # `cn()` — clsx + tailwind-merge
├── i18n.ts                     # i18next initialization (en + ms)
├── i18n-performance.ts         # Lazy locale loading, @ts-ignore for experimental APIs
├── themeManager.ts             # Theme system bootstrap (called from main.tsx)
├── theme.ts                    # @deprecated — legacy theme utilities
├── themeConfig.ts              # Theme config constants
├── themeUtils.ts               # Theme utility functions
├── supabase.ts                 # Supabase client initialization
├── ai-search.ts                # AI search utilities, @deprecated semanticSearch
├── receipts/
│   └── validation.ts           # Receipt validation, hardcoded MYR rate 4.75
├── export/
│   └── (export utilities)
├── batch-session/
│   └── (batch upload session mgmt)
├── rate-limiting/
│   └── (client-side rate limiters)
├── cache/
│   └── cache-manager.ts        # In-memory cache, TODO: Redis
├── currency-converter.ts       # Static rates, TODO: live API
├── feature-flags/
│   └── manager.ts              # Feature flag system, hardcoded user values
└── ...
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| ClassName composition | `utils.ts` | `cn(...)` — use everywhere |
| Add translation key | `i18n.ts` + `src/locales/{en,ms}/` | Hierarchical keys |
| Theme toggle / dark mode | `themeManager.ts` | Called before React render in `main.tsx` |
| Supabase client config | `supabase.ts` | Singleton — never re-instantiate |
| AI search / embeddings | `ai-search.ts` | `semanticSearch` is deprecated |
| Receipt validation | `receipts/validation.ts` | Hardcoded rate — TODO |
| Currency conversion | `currency-converter.ts` | Static rates — TODO |
| Feature flags | `feature-flags/manager.ts` | Hardcoded user_name/IP — TODO |
| Caching | `cache/cache-manager.ts` | In-memory only — TODO: Redis |

## CONVENTIONS

- **`cn()` is the ONLY className utility** — Always import from `@/lib/utils`. Never use raw `clsx` or `tailwind-merge` directly.
- **i18next keys are hierarchical** — `common.buttons.save`, `dashboard.receipts.upload_success`. Malay (`ms/`) mirrors English (`en/`) structure.
- **Browser API polyfills** — `src/lib/i18n-performance.ts` uses `@ts-ignore` for `navigator.connection` and `navigator.deviceMemory` (experimental). Acceptable pattern here.
- **TODO stubs are common** — Hardcoded values in `validation.ts`, `currency-converter.ts`, `feature-flags/manager.ts`, `cache-manager.ts`. Do not rely on them for production.

## ANTI-PATTERNS

- `src/lib/theme.ts` is **deprecated** — Use `ThemeContext` + `useTheme` instead.
- `src/lib/ai-search.ts` `semanticSearch()` is **deprecated** — Use `supabase/functions/unified-search/`.
- Do not add new hardcoded stub values — if implementing a TODO, fetch from real APIs or env vars.
