# CapitalForge — Known Issues & Technical Debt

> **Version:** 1.0 · **Last updated:** 2026-05-24

---

## How AI Agents Should Use This Document

1. **Check before fixing bugs** — the issue may already be documented with context.
2. **Add new issues** when discovered; link to FEATURE_BACKLOG ID if tracked there.
3. **Remove or mark resolved** when fixed in a merged PR.
4. **Do not introduce workarounds** that conflict with documented fixes.

---

## Current Bugs

| ID | Severity | Module | Description | Workaround | Fix Reference |
|----|----------|--------|-------------|------------|---------------|
| BUG-001 | Critical | auth | `AuthBypassMiddleware` injects first DB user on all requests, bypassing JWT | None — dev only | F-003, G-16 |
| BUG-002 | High | strategy | `generateStrategy()` uses equal-split instead of multiplier rules | Manual buy plan review | F-008, G-08 |
| BUG-003 | High | strategy | `executeBuyPlan` increments `*UsedUSD` but doesn't decrement `*RemainingUSD` | Manual recalculate buckets | F-007, G-07 |
| BUG-004 | High | transaction | Edit/delete doesn't reverse allocation/bucket state | Avoid editing transactions | F-006, G-06 |
| BUG-005 | Medium | portfolio | Budget change doesn't auto-trigger bucket recalculation | POST `/allocations/recalculate` manually | F-002, G-02 |
| BUG-006 | Medium | analytics | `getPerformanceAnalytics` returns single data point | Use timeseries endpoint instead | F-016, G-18 |
| BUG-007 | Low | market-data | Price history retention ~14 days, not 90 | Limited chart range | F-010, G-11 |
| BUG-008 | Low | frontend | 401 redirect may loop if login page also calls protected API | Clear localStorage manually | — |

---

## Technical Debt

| ID | Priority | Area | Description | Impact | Remediation |
|----|----------|------|-------------|--------|-------------|
| DEBT-001 | P0 | strategy | Legacy `buyQuantity` in seed data / old snapshots | Wrong buy amounts | Migrate seed to multipliers (F-001) |
| DEBT-002 | P0 | auth | Global auth bypass middleware | Security | Remove middleware (F-003) |
| DEBT-003 | P1 | backend/.env.example | Shows DIP=0.4, CRASH=0 (wrong ratios) | Confusing setup | Update example; ratios are in DB now |
| DEBT-004 | P1 | frontend | No automated test suite | Regression risk | Add Vitest + component tests |
| DEBT-005 | P1 | backend | Limited unit test coverage for strategy engine | Excel parity unverified | Add strategy.service.spec.ts |
| DEBT-006 | P2 | transaction | No pagination on list endpoint | Slow for large portfolios | F-012 |
| DEBT-007 | P2 | frontend | Budget preview not implemented | Poor UX for budget changes | F-004 |
| DEBT-008 | P2 | strategy | Weekly dip buy trigger not implemented | Missing buy signal | F-005 |
| DEBT-009 | P3 | backend | NestJS default README still in backend/ | Noise | Replace with project README |
| DEBT-010 | P3 | frontend | Some pages use `any` types in API responses | Type safety | Type all analytics responses |

---

## Temporary Workarounds

| Workaround | Use When | Do NOT Use When |
|------------|----------|-----------------|
| POST `/portfolios/:id/allocations/recalculate` | After budget change until F-002 done | In production automation — fix the root cause |
| Manual bucket verification in Prisma Studio | Suspected bucket drift | As permanent solution |
| Skip auth testing locally | Auth bypass active | Never in production |
| Direct DB edit for new stocks | Until F-014 add-stock wizard | For routine operations |

---

## PRD Implementation Gaps (Cross-Reference)

From `PRD.md` Section 8:

| Gap ID | Status | Feature |
|--------|--------|---------|
| G-01 | In progress | F-001 |
| G-02 | In progress | F-002 |
| G-03 | Backlog | F-004 |
| G-04 | Partial | `dcaWeeksPerYear` in schema, not in UI |
| G-05 | Done | Ratios moved to DB |
| G-06 | Backlog | F-006 |
| G-07 | Backlog | F-007 |
| G-08 | In progress | F-008 |
| G-09 | Backlog | F-005 |
| G-10 | Partial | Schema ready, logic partial |
| G-11 | Backlog | F-010 |
| G-12 | Backlog | F-015 |
| G-13 | Partial | Investor model, no UI |
| G-14 | Backlog | F-012 |
| G-15 | Backlog | F-013 |
| G-16 | Backlog | F-003 |
| G-17 | Backlog | F-014 |
| G-18 | Backlog | F-016 |

---

## Future Improvements

| Improvement | Benefit | Effort |
|-------------|---------|--------|
| Scheduled market sync (cron) | Always-fresh prices | Medium |
| Email alerts on dip threshold | Proactive buy signals | Medium |
| Strategy engine unit tests with Excel fixtures | Confidence in calculations | Low |
| React Query adoption across all pages | Consistent caching/loading states | Medium |
| Row-level security on portfolios | Multi-user safety | High |
| Transaction audit log table | Full state change history | Medium |
| Dark mode polish | UX | Low |

---

## Reporting an Issue

When adding a new issue, use this template:

```markdown
| BUG-0XX | [Critical/High/Medium/Low] | [module] | [description] | [workaround or None] | F-0XX |
```

Update `FEATURE_BACKLOG.md` if the fix is planned work.

---

## Related Documents

- [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md) — Planned fixes
- [PRD.md](../../PRD.md) — Gap analysis source
- [debugging-skill.md](../skills/debugging-skill.md) — Investigation process
