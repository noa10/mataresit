# src/components/ui AGENTS.md

## OVERVIEW
shadcn/ui primitive components — 57 files. Radix UI primitives + Tailwind CSS + `cn()` utility. The project's design system foundation.

## STRUCTURE
```
src/components/ui/
├── button.tsx       # Primary CTA, ghost, outline, link variants
├── card.tsx         # Container with header/content/footer
├── dialog.tsx       # Modal overlay with radix primitives
├── dropdown-menu.tsx
├── table.tsx        # Data tables with sorting scaffolding
├── tabs.tsx
├── accordion.tsx
├── calendar.tsx     # Date picker (date-fns + react-day-picker)
├── chart.tsx        # Recharts wrappers
├── command.tsx      # Command palette / combobox
├── form.tsx         # react-hook-form integration
├── input.tsx
├── textarea.tsx
├── select.tsx
├── skeleton.tsx     # Loading placeholders
├── toast.tsx        # Sonner toast styling
├── badge.tsx
├── avatar.tsx
├── progress.tsx
├── slider.tsx
├── switch.tsx
├── tooltip.tsx
├── popover.tsx
├── separator.tsx
├── scroll-area.tsx
├── collapsible.tsx
├── hover-card.tsx
├── menubar.tsx
├── navigation-menu.tsx
├── pagination.tsx
├── radio-group.tsx
├── resizable.tsx
├── sheet.tsx        # Slide-over panel
├── sidebar.tsx      # App sidebar layout
├── toggle.tsx
├── toggle-group.tsx
└── ... (remaining primitives)
```

## CONVENTIONS

- **Forward refs** — All interactive components use `React.forwardRef`.
- **`displayName`** — Set on every forwarded component for debugging.
- **`cn()` utility** — From `@/lib/utils`. Use for ALL conditional className composition. Combines `clsx` + `tailwind-merge`.
- **Variants via `cva`** — `class-variance-authority` for component variants (button sizes, dialog sizes, etc.).
- **HSL CSS variables** — Colors reference CSS custom properties (`--primary`, `--destructive`, `--muted`, etc.) defined in `src/index.css`.
- **Dark mode support** — All components handle `dark:` prefix. Theme toggled via `ThemeContext`.
- **Destructured props with defaults** — e.g., `function Button({ variant = "default", size = "default", ...props })`.

## WHERE TO LOOK

| Need | Component | Notes |
|------|-----------|-------|
| Button | `button.tsx` | Variants: default, destructive, outline, secondary, ghost, link. Sizes: default, sm, lg, icon |
| Modal / Dialog | `dialog.tsx` | Radix Dialog primitive. Use `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter` |
| Form field | `form.tsx` | Integrates `react-hook-form` + `zod`. Use `FormField`, `FormItem`, `FormControl`, `FormMessage` |
| Data table | `table.tsx` | Basic table + `DataTable` component with sorting hooks |
| Date picker | `calendar.tsx` | `react-day-picker` wrapper. Use with `Popover` for input |
| Toast | `toast.tsx` | Styled for `sonner`. Call `toast.success/error/info()` from anywhere |
| Command palette | `command.tsx` | `cmdk` wrapper. Use for search, combobox, multi-select |
| Loading skeleton | `skeleton.tsx` | Use for all async content placeholders |
| Sidebar layout | `sidebar.tsx` | App sidebar with collapsible groups |

## ANTI-PATTERNS

- **Do NOT add one-off styles** — If a component needs custom styling, extend via `cva` variants or create a new primitive. Do not inline arbitrary Tailwind classes.
- **Do NOT use raw Radix imports** — Always import from `@/components/ui/*` wrappers. The wrappers add consistent styling, refs, and accessibility.
- **Do NOT add business logic** — These are presentational primitives only. Business logic belongs in `src/pages/` or `src/services/`.
