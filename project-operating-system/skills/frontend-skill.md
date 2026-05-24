# Frontend Skill — CapitalForge

> Reusable AI operating instructions for Next.js frontend work.

## When to Use

Load this skill when modifying pages, components, API client, styling, or frontend state in `frontend/`.

## Prerequisites

1. Read `docs/PROJECT_CONTEXT.md` — business rules and module boundaries
2. Check `docs/FEATURE_BACKLOG.md` for task scope
3. Reference `docs/API_CONTRACTS.md` for endpoint shapes

---

## UI Architecture Rules

- **App Router** — pages in `src/app/<route>/page.tsx`
- **Layout shell** — all authenticated pages wrapped by `AppShell` via root layout
- **Separation:**
  - `components/ui/` — shadcn primitives (do not add business logic)
  - `components/layout/` — sidebar, header, navigation
  - Page files — data fetching + composition only
- **No business logic in UI components** — budget/strategy calculations belong in `lib/` utilities or come from API

---

## Component Structure

```
src/
├── app/
│   ├── layout.tsx          # Providers + AppShell
│   ├── page.tsx            # Dashboard
│   ├── strategy/page.tsx   # Main strategy screen
│   └── ...
├── components/
│   ├── layout/             # AppShell, Sidebar, Header
│   └── ui/                 # shadcn (Button, Card, Table...)
├── contexts/               # Auth, Portfolio
└── lib/
    ├── api.ts              # ALL HTTP calls
    ├── types.ts            # Shared interfaces
    └── utils.ts            # cn(), formatters
```

**New page checklist:**
```
□ Create src/app/<route>/page.tsx
□ Add nav link in sidebar.tsx and bottom-tab-bar.tsx
□ Wrap with ProtectedRoute if auth required
□ Use portfolio context for active portfolioId
□ Add API methods to lib/api.ts (not inline axios)
```

---

## State Management Rules

| State | Where | Pattern |
|-------|-------|---------|
| Auth token/user | `auth-context.tsx` | Context + localStorage |
| Active portfolio | `portfolio-context.tsx` | Context, set on login |
| Server data | Page-level useEffect or React Query | Fetch on mount / invalidate on mutation |
| Form state | react-hook-form + zod | Per form |
| Budget preview | Client-side useMemo | Compute from formula, don't save until Apply |

**Do not** add Redux, Zustand, or new state libraries without ADR in `DECISION_LOG.md`.

---

## Styling Conventions

- **TailwindCSS 4** utility classes
- **shadcn/ui** components — extend via `className`, not fork
- **Theme:** `next-themes` with dark mode support via `ThemeProvider`
- **Icons:** `lucide-react`
- **Toasts:** `sonner` via `toast.success()` / `toast.error()`
- **Charts:** Recharts — responsive container, consistent color palette from CSS variables

**Money display:**
```tsx
// Format USD with 2 decimal places
new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
```

**Percentages:** 1 decimal place for dip %, 2 for allocation %

---

## Performance Optimization

- Use `"use client"` only when needed (interactivity, hooks, browser APIs)
- Lazy load heavy chart components with `dynamic(() => import(...), { ssr: false })`
- Debounce budget preview input (300ms)
- Avoid re-fetching entire portfolio on every keystroke — preview is client-side
- Table virtualization only if > 100 rows (not needed yet)

---

## Accessibility Rules

- All form inputs have associated `<Label>`
- Buttons have descriptive text (not icon-only without aria-label)
- Tables use semantic `<Table>`, `<TableHead>`, `<TableBody>`
- Color alone must not convey buy signal — add text/icon (e.g., "BUY SIGNAL" badge)
- Focus management in dialogs (shadcn Dialog handles this)

---

## Key Frontend Patterns

### API call in page

```tsx
'use client';
import { useEffect, useState } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { strategyApi } from '@/lib/api';

export default function StrategyPage() {
  const { activePortfolio } = usePortfolio();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!activePortfolio) return;
    strategyApi.getStrategyTable(activePortfolio.id).then(setData);
  }, [activePortfolio]);

  // render...
}
```

### Budget preview (client-side)

```tsx
// Pure function — no API call
function computeWeeklyDCA(totalBudget: number, targetPercent: number, coreRatio: number, weeks: number) {
  const allocationUSD = totalBudget * (targetPercent / 100);
  const coreBucket = allocationUSD * coreRatio;
  return coreBucket / weeks;
}
```

---

## Anti-Patterns

| Anti-Pattern | Why Bad | Do Instead |
|--------------|---------|------------|
| Axios calls outside `lib/api.ts` | Duplication, no interceptors | Add method to api.ts |
| Storing money as JS number in state | Floating point drift | Parse from API strings; display formatted |
| Hardcoded API URLs | Breaks prod | Use `NEXT_PUBLIC_API_URL` |
| Business logic in shadcn ui/ components | Unmaintainable | Extract to lib/ or backend |
| Refactoring unrelated pages | Scope creep | Touch only task-related routes |
| New CSS module files | Inconsistent with Tailwind | Use Tailwind utilities |
| Skipping ProtectedRoute | Security hole | Wrap authenticated pages |

---

## Files to Know

| File | Purpose |
|------|---------|
| `lib/api.ts` | All API methods |
| `lib/types.ts` | TypeScript interfaces matching backend DTOs |
| `contexts/auth-context.tsx` | Login/logout/token |
| `contexts/portfolio-context.tsx` | Active portfolio selection |
| `components/protected-route.tsx` | Auth guard wrapper |
| `components/layout/app-shell.tsx` | Main layout |

---

## Related Skills

- [backend-skill.md](./backend-skill.md) — API changes
- [testing-skill.md](./testing-skill.md) — Frontend tests
- [code-review-skill.md](./code-review-skill.md) — PR review
