# CapitalForge — Decision Log

> **Version:** 1.0 · **Last updated:** 2026-05-24  
> Architecture Decision Records (ADR) for CapitalForge.

---

## How AI Agents Should Use This Document

1. **Read before proposing architectural changes** — a decision may already exist.
2. **Add a new ADR** when introducing: new dependencies, module boundaries, data model changes, auth changes, or deployment changes.
3. **Do not reverse a decision** without adding a superseding ADR that explains why.
4. Use the template at the bottom of this file.

---

## Decision Index

| ID | Title | Date | Status |
|----|-------|------|--------|
| ADR-001 | Modular monolith over microservices | 2026-03-01 | Accepted |
| ADR-002 | Multiplier-based strategy rules | 2026-05-01 | Accepted |
| ADR-003 | Per-portfolio bucket ratios in DB | 2026-05-01 | Accepted |
| ADR-004 | PostgreSQL via Supabase | 2026-03-01 | Accepted |
| ADR-005 | JWT auth with localStorage | 2026-03-01 | Accepted |
| ADR-006 | Yahoo Finance for market data | 2026-03-01 | Accepted |
| ADR-007 | Prisma Decimal for monetary values | 2026-03-01 | Accepted |
| ADR-008 | Next.js App Router + shadcn/ui | 2026-03-01 | Accepted |
| ADR-009 | 48 trading weeks per year (not 52) | 2026-05-01 | Accepted |
| ADR-010 | No message queue in V1 | 2026-03-01 | Accepted |
| ADR-011 | Render backend + Vercel frontend | 2026-04-01 | Accepted |
| ADR-012 | Deprecate strategyReferenceBudget | 2026-05-01 | Accepted |

---

## ADR-001: Modular Monolith over Microservices

**Date:** 2026-03-01  
**Status:** Accepted  
**Owner:** Engineering  
**Supersedes:** —

### Context

CapitalForge is a family portfolio tool with 1–2 users, 5–20 stocks, and synchronous workflows. Splitting into microservices adds operational overhead without benefit at this scale.

### Decision

Build as a **modular monolith**: NestJS with domain modules (auth, portfolio, strategy, etc.) sharing one PostgreSQL database.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Microservices (strategy service separate) | Over-engineering for user count and traffic |
| Serverless functions per endpoint | Cold starts, harder local dev, NestJS doesn't fit well |
| Full-stack Next.js API routes | Would duplicate validation logic; NestJS better for complex domain |

### Consequences

- **Positive:** Simple deployment, easy local dev, shared transactions
- **Negative:** Must enforce module boundaries via code review
- **Risks:** Strategy module could grow large — mitigate with service extraction methods, not new deployables

---

## ADR-002: Multiplier-Based Strategy Rules

**Date:** 2026-05-01  
**Status:** Accepted  
**Owner:** Product + Engineering

### Context

Original implementation stored raw `buyQuantity` (shares) in StrategyRule and scaled via `strategyReferenceBudget`. This caused rounding errors and stale amounts when budget changed.

Excel logic proves buy amounts are always `weeklyDCA × multiplier`.

### Decision

Store **multipliers** (1, 3, 5) in `StrategyRule.buyMultiplier`. Compute buyUSD at render/execution time from current `weeklyDCA`.

Remove `strategyReferenceBudget` from Portfolio.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Store raw USD amounts | Stale on budget change; requires manual refresh |
| Store share quantities + scale factor | Rounding errors; complex scaling logic |
| Compute everything client-side only | No audit trail; inconsistent with transaction recording |

### Consequences

- **Positive:** Budget changes propagate automatically; matches Excel exactly
- **Negative:** Requires migration of existing seed data and strategy.service rewrite
- **Risks:** G-01, G-08 in PRD — in progress

---

## ADR-003: Per-Portfolio Bucket Ratios in DB

**Date:** 2026-05-01  
**Status:** Accepted  
**Owner:** Engineering

### Context

`.env` had `CORE_BUCKET_RATIO=0.6, DIP=0.4, CRASH=0` (sums to 1.0 but wrong split). Excel uses 60/30/10. Env vars are global and can't vary per portfolio.

### Decision

Store `coreRatio`, `dipRatio`, `crashRatio` on `Portfolio` model. Defaults: 0.60, 0.30, 0.10. Validation: must sum to 1.0.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Keep env vars | Global only; wrong defaults |
| Hardcode 60/30/10 | No flexibility for future portfolios |

### Consequences

- **Positive:** Correct Excel alignment; per-portfolio customization
- **Negative:** Must migrate away from env-based ratios
- **Risks:** G-05 in PRD — partially resolved

---

## ADR-004: PostgreSQL via Supabase

**Date:** 2026-03-01  
**Status:** Accepted  
**Owner:** Engineering

### Context

Need managed PostgreSQL with connection pooling, free tier for development, and easy migration path.

### Decision

Use Supabase-hosted PostgreSQL with Prisma. Pooled URL for runtime, direct URL for migrations.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Local PostgreSQL only | No shared prod environment |
| SQLite | No Decimal precision guarantees; no pooling |
| MongoDB | Relational data model fits SQL better |

---

## ADR-005: JWT Auth with localStorage

**Date:** 2026-03-01  
**Status:** Accepted  
**Owner:** Engineering

### Context

Simple auth for a small user base. No OAuth requirement in V1.

### Decision

JWT tokens stored in `localStorage`. Axios interceptor attaches Bearer token. 7-day expiration.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| httpOnly cookies | Requires CSRF handling; more complex with separate frontend domain |
| Supabase Auth | Adds dependency; custom JWT sufficient for V1 |
| Session-based | Requires server-side session store |

### Risks

- XSS could steal token — acceptable for V1 family use; revisit for multi-tenant

---

## ADR-006: Yahoo Finance for Market Data

**Date:** 2026-03-01  
**Status:** Accepted  
**Owner:** Engineering

### Context

Need free market data for US equities and ETFs. No real-time streaming requirement.

### Decision

Use `yahoo-finance2` npm package. Sync on-demand; store in `prices_daily`. No WebSocket.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Alpha Vantage | API key limits on free tier |
| Polygon.io | Paid for production use |
| IEX Cloud | Discontinued/shifted pricing |

### Risks

- Unofficial API; may break — mitigated by DB caching and graceful degradation

---

## ADR-007: Prisma Decimal for Monetary Values

**Date:** 2026-03-01  
**Status:** Accepted  
**Owner:** Engineering

### Context

JavaScript floating-point causes drift in financial calculations (e.g., 0.1 + 0.2 ≠ 0.3).

### Decision

All monetary fields use Prisma `@db.Decimal(18, 2)` for USD amounts and `@db.Decimal(18, 4)` for prices. Convert to/from Decimal in service layer.

---

## ADR-008: Next.js App Router + shadcn/ui

**Date:** 2026-03-01  
**Status:** Accepted  
**Owner:** Engineering

### Context

Need responsive web UI with charts, tables, and forms. Team familiar with React.

### Decision

Next.js 16 App Router with shadcn/ui (Radix + Tailwind). Recharts for data visualization.

---

## ADR-009: 48 Trading Weeks per Year

**Date:** 2026-05-01  
**Status:** Accepted  
**Owner:** Product

### Context

Excel uses 48 weeks (not 52) for weekly DCA calculation: `weeklyDCA = coreBucket / 48`.

### Decision

Default `dcaWeeksPerYear = 48` on Portfolio. User-configurable to 52 if desired.

---

## ADR-010: No Message Queue in V1

**Date:** 2026-03-01  
**Status:** Accepted  
**Owner:** Engineering

### Context

All operations are user-triggered and complete in < 5 seconds.

### Decision

No Redis, BullMQ, or event bus in V1. Revisit for scheduled market sync in V2.

---

## ADR-011: Render Backend + Vercel Frontend

**Date:** 2026-04-01  
**Status:** Accepted  
**Owner:** Engineering

### Context

Need free/cheap hosting with minimal DevOps.

### Decision

- Backend: Render Web Service (NestJS, port from env)
- Frontend: Vercel (Next.js)
- Database: Supabase

---

## ADR-012: Deprecate strategyReferenceBudget

**Date:** 2026-05-01  
**Status:** Accepted  
**Owner:** Engineering  
**Supersedes:** Original budget scaling approach

### Context

`strategyReferenceBudget` was a workaround for storing share quantities. With ADR-002 (multipliers), it is unnecessary.

### Decision

Remove field from Portfolio. All scaling happens via multiplier × current weeklyDCA.

---

## ADR Template

Copy for new decisions:

```markdown
## ADR-XXX: [Title]

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-YYY
**Owner:** [Name/Role]

### Context
[What is the issue?]

### Decision
[What is the change?]

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|

### Consequences
- **Positive:** ...
- **Negative:** ...
- **Risks:** ...
```
