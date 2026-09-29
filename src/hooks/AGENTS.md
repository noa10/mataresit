# src/hooks AGENTS.md

## OVERVIEW
Custom React hooks — 46 files. Server state via TanStack Query, UI state via useReducer, side effects via useEffect.

## STRUCTURE
```
src/hooks/
├── useAuth.ts                  # Auth state wrapper (delegates to AuthContext)
├── useTheme.ts                 # Theme state wrapper (delegates to ThemeContext)
├── useLanguage.ts              # i18n language detection & switching
├── useAlertEngine.ts           # Alert rule evaluation engine (85% coverage req)
├── useBatchFileUpload.ts       # 2002 lines — batch receipt upload with queue
├── useDuplicateDetection.ts    # Receipt duplicate scanning
├── usePushNotifications.ts     # Push notification management
├── useFeatureFlags.tsx         # Feature flag access
├── useReceipts.ts              # Receipt data fetching (React Query)
├── useTeams.ts                 # Team data fetching
├── useSearch.ts                # Search state management
├── useDebounce.ts              # Input debouncing
├── useLocalStorage.ts          # localStorage sync hook
├── useMediaQuery.ts            # Responsive breakpoint detection
├── useIntersectionObserver.ts  # Lazy loading / infinite scroll
├── usePrevious.ts              # Previous value reference
└── ...
```

## CONVENTIONS

- **Prefix all hooks with `use`** — `useAuth`, `useBatchFileUpload`. Never omit the prefix.
- **Server state = TanStack Query** — Data fetching hooks use `useQuery`/`useMutation` with cache keys. Stale time: 5 minutes.
- **UI/Local state = useReducer or useState** — Complex state uses `useReducer` with action types. Simple state uses `useState`.
- **Side effects = useEffect** — Standard pattern. Clean up subscriptions, timers, and event listeners.
- **Tests co-located in `__tests__/`** — e.g., `hooks/__tests__/useAuth.test.ts`.
- **Mock pattern**: `vi.mock('@/lib/supabase')` at module level, `vi.hoisted()` for shared mock refs.

## WHERE TO LOOK

| Task | Hook | Notes |
|------|------|-------|
| Get current user | `useAuth` | Wraps `AuthContext`. Returns `{ user, loading, error }` |
| Check permissions | `useAuth` | Check `user.role` or use `AdminRoute` component |
| Fetch receipts | `useReceipts` | React Query with pagination |
| Batch upload | `useBatchFileUpload` | 2000+ lines — queue, progress, retry logic |
| Duplicate scan | `useDuplicateDetection` | Returns `scan()`, `data`, `isLoading`, `error` |
| Theme toggle | `useTheme` | Wraps `ThemeContext`. Returns `{ theme, setTheme }` |
| Language switch | `useLanguage` | Wraps `LanguageContext`. Returns `{ language, setLanguage }` |
| Feature flag check | `useFeatureFlags` | Returns `isEnabled(flagName)` |
| Debounced input | `useDebounce` | Standard debounce with cleanup |
| Infinite scroll | `useIntersectionObserver` | For pagination / lazy loading |

## ANTI-PATTERNS

- **`useFeatureFlags.tsx` line 190** — `useFeatureFlag()` called inside a `forEach` loop, violating React Rules of Hooks. Suppressed with `eslint-disable react-hooks/rules-of-hooks`. Do NOT replicate this pattern.
- **`usePushNotifications.ts` line 235** — `useNotificationPreferences()` is deprecated. Use `useNotifications().preferences` instead.
- Do NOT call hooks conditionally or inside loops — standard React rules apply.
