# Agent Guidelines for MataResit

This document provides guidelines for AI agents working in this repository.

## Build, Lint, and Test Commands

### Building
```bash
npm run build          # Production build
npm run build:dev      # Development build
npm run preview        # Preview production build
```

### Linting
```bash
npm run lint           # Run ESLint on all files
```

### Testing
```bash
# Run all tests
npm run test

# Run specific test suites
npm run test:unit      # Unit tests only
npm run test:integration # Integration tests only

# Run a single test file (CRITICAL - use this when fixing specific tests)
npx vitest run src/services/__tests__/receiptService.pagination.test.ts

# Run a specific test by name
npx vitest run -t "returns empty pagination payload when user is unauthenticated"

# Run tests in watch mode during development
npx vitest
```

## Code Style Guidelines

### Imports
- **ALWAYS use path aliases** with `@/` prefix (e.g., `@/components/ui/button`, `@/services/receiptService`)
- Order: React → External libraries → Internal modules (@/)
- Use named imports where possible

### TypeScript
- Use strict TypeScript with interfaces for type definitions
- Place shared types in `src/types/` directory
- Use type assertions carefully with `as unknown as Type` pattern for Supabase data

### Naming Conventions
- **Components**: PascalCase (e.g., `ReceiptCard.tsx`)
- **Functions/Variables**: camelCase (e.g., `fetchReceiptsPage`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Types/Interfaces**: PascalCase with descriptive names
- **Files**: PascalCase for components, camelCase for utilities

### Component Patterns
- Use functional components with hooks
- Forward refs using `React.forwardRef` for UI components
- Use `displayName` for better debugging
- Use destructured props with default values

### Error Handling
```typescript
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  console.error("Descriptive error message:", error);
  toast.error("User-friendly error message");
  return null; // or appropriate fallback
}
```

### UI/Styling
- Use **shadcn/ui** components from `@/components/ui/`
- Style with **Tailwind CSS** utility classes
- Use `cn()` utility from `@/lib/utils` for conditional classes
- Follow the project's color token system (primary, destructive, muted, etc.)
- Support both light and dark modes

### Testing Patterns
- Use **Vitest** with `vi.mock()` for mocking dependencies
- Use `vi.hoisted()` for mock variables that need to be referenced in mocks
- Clear mocks in `beforeEach` with `vi.clearAllMocks()`
- Use `@testing-library/react` for component tests
- Mock external services (Supabase, etc.) at the module level

### Key Project Patterns
- Use **React Query** for server state management with proper cache keys
- Use **Supabase** for backend operations through `@/integrations/supabase/client`
- Use **sonner** for toast notifications
- Use **date-fns** for date formatting
- Use **lucide-react** for icons
- Currency default is **MYR** (Malaysian Ringgit)

### File Structure
```
src/
  components/     # UI components (shadcn/ui + custom)
  contexts/       # React contexts
  integrations/   # Third-party integrations
  lib/            # Utility functions and helpers
  pages/          # Route pages
  services/       # Business logic and API calls
  types/          # TypeScript type definitions
```

### Git Workflow
- Do NOT commit unless explicitly asked
- Never commit secrets, API keys, or .env files
- Run lint and test commands before finishing tasks

### Supabase Migrations

#### Standard Workflow
```bash
# Check migration status
npm run supabase:migrate:list

# Create new migration
npm run supabase:migrate:new -- migration_name

# Preview changes (dry run)
npm run supabase:push:dry

# Apply migrations
npm run supabase:push

# For migrations with older timestamps than latest remote
supabase db push --include-all
```

#### Prerequisites
- Set `SUPABASE_DB_PASSWORD` in `.env.local` (get from Supabase Dashboard → Settings → Database)
- Run `supabase login` (credentials cached)
- Run `supabase link --project-ref mpmkbtsufihzdelrlszs`

#### Migration History Sync (2026-03-27)
All 302 migrations are now synced between local and remote:
- Fixed 4 duplicate timestamps by incrementing by 1 second
- Created 181 placeholder files for remote-only migrations
- Marked 88 local-only migrations as applied (they were manually applied to remote)
- Migration drift resolved - `supabase db push` now works correctly

#### Troubleshooting
- If `supabase db push` fails with "tuple concurrently updated": ensure `SUPABASE_DB_PASSWORD` is set
- If local/remote drift occurs: use `supabase migration repair <version> --status applied`
- For schema comparison: `npm run supabase:diff`

### Performance Considerations
- Use React.memo for expensive components
- Use useMemo/useCallback appropriately
- Implement proper loading states
- Use pagination for large datasets

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **mataresit** (10101 symbols, 29268 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/mataresit/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/mataresit/context` | Codebase overview, check index freshness |
| `gitnexus://repo/mataresit/clusters` | All functional areas |
| `gitnexus://repo/mataresit/processes` | All execution flows |
| `gitnexus://repo/mataresit/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## CLI

- Re-index: `npx gitnexus analyze`
- Check freshness: `npx gitnexus status`
- Generate docs: `npx gitnexus wiki`

<!-- gitnexus:end -->
