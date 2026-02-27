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

### Performance Considerations
- Use React.memo for expensive components
- Use useMemo/useCallback appropriately
- Implement proper loading states
- Use pagination for large datasets
