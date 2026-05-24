# Database Skill — CapitalForge

> Reusable AI operating instructions for PostgreSQL/Prisma work.

## When to Use

Load when modifying `schema.prisma`, writing migrations, optimizing queries, or seed data.

---

## Schema Design Standards

- **UUID primary keys** — `@id @default(uuid())`
- **Timestamps** — `createdAt @default(now())`, `updatedAt @updatedAt`
- **Money** — `@db.Decimal(18, 2)` for USD amounts
- **Prices** — `@db.Decimal(18, 4)` for stock prices
- **Shares** — `@db.Decimal(18, 6)` for fractional shares
- **Percentages** — `@db.Decimal(5, 2)` for target %, `@db.Decimal(5, 4)` for ratios
- **Soft delete** — use `isActive Boolean @default(true)` (not deletedAt in V1)
- **Table names** — snake_case via `@@map("table_name")`
- **Foreign keys** — always `@index` on FK columns

---

## Core Models Reference

| Model | Purpose | Key Fields |
|-------|---------|------------|
| User | Auth | email (unique), password (bcrypt) |
| Portfolio | Root entity | totalCapital, coreRatio, dipRatio, crashRatio, dcaWeeksPerYear |
| Allocation | Per-stock config | targetPercentage, weeklyDCA, bucket usage, sharesOwned |
| StrategyRule | Dip-level multipliers | symbol, dipPercent, buyMultiplier |
| Transaction | Ledger | type, price, quantity, total, date |
| PriceDaily | Market cache | symbol, date, close, fiftyTwoWeekHigh |
| WeeklyBudget | Weekly spend tracking | plannedAmount, usedAmount |
| BuyPlan | Generated buy signal | dipLevelTriggered, capitalRequired, bucketUsed |

Full schema: `backend/prisma/schema.prisma`

---

## Migration Strategy

```bash
# 1. Edit schema.prisma
# 2. Create migration
cd backend
npx prisma migrate dev --name descriptive_name

# 3. Verify
npx prisma migrate status

# 4. Production
npx prisma migrate deploy
```

**Rules:**
- Never edit applied migration SQL files
- One logical change per migration
- Name descriptively: `add_strategy_multipliers`, `add_investor_model`
- Test migration on copy of prod data before deploying
- Include seed updates in same PR if schema affects seed

---

## Indexing Strategy

**Existing indexes (maintain):**
```prisma
@@index([portfolioId])           // All portfolio-scoped tables
@@index([portfolioId, symbol])   // Allocations, strategy rules
@@index([symbol, date])          // PriceDaily
@@index([date])                  // Transactions
@@unique([portfolioId, symbol])  // Allocations
@@unique([portfolioId, symbol, dipPercent])  // Strategy rules
```

**Add index when:**
- Column appears in WHERE clause on large tables
- Column used in ORDER BY for paginated queries
- Composite queries filter on multiple columns together

**Do not over-index** — each index slows writes.

---

## Query Optimization

```typescript
// GOOD — select only needed fields
const allocations = await this.prisma.allocation.findMany({
  where: { portfolioId, isActive: true },
  select: {
    symbol: true,
    weeklyDCA: true,
    sharesOwned: true,
    coreRemainingUSD: true,
  },
});

// GOOD — use include sparingly, prefer select
const portfolio = await this.prisma.portfolio.findUnique({
  where: { id },
  include: { allocations: { where: { isActive: true } } },
});

// BAD — fetch all then filter in JS
const all = await this.prisma.transaction.findMany();
const filtered = all.filter(t => t.symbol === 'NVDA');
// Use WHERE clause instead
```

**Pagination (target pattern):**
```typescript
const [data, total] = await Promise.all([
  this.prisma.transaction.findMany({
    where: { portfolioId },
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { date: 'desc' },
  }),
  this.prisma.transaction.count({ where: { portfolioId } }),
]);
```

---

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Model | PascalCase singular | `WeeklyBudget` |
| Table | snake_case plural | `weekly_budgets` |
| Column | camelCase in Prisma | `totalCapital` |
| Enum | PascalCase | `TransactionType.BUY` |
| FK field | `{model}Id` | `portfolioId` |
| Boolean flags | `is*` prefix | `isActive`, `isAggressive` |
| USD amounts | `*USD` suffix | `coreBucketUSD`, `coreUsedUSD` |
| Remaining | `*RemainingUSD` | `dipRemainingUSD` |

---

## Seed Data

Location: `backend/prisma/seed.ts`

- Imports from `Stocks Strategy.xlsx` if present in repo root
- Falls back to demo data
- Must use multipliers (not raw quantities) after F-001
- Demo user: `demo@capitalforge.com` / `password123`

```bash
npx prisma db seed
```

---

## Data Integrity Rules

- Bucket ratios on Portfolio must sum to 1.0 (enforce in service layer)
- `remainingUSD = bucketUSD - usedUSD` (recalculate, don't trust stale)
- Transaction side effects must be atomic (`$transaction`)
- Cascade deletes: Portfolio → all child records
- No orphaned BuyPlans (cascade from StrategySnapshot)

---

## Anti-Patterns

| Anti-Pattern | Do Instead |
|--------------|------------|
| Float columns for money | Decimal |
| Raw SQL without parameterization | Prisma queries |
| Deleting applied migrations | New forward migration |
| Storing computed weeklyDCA without recalc trigger | Recalculate on budget change |
| Manual ID generation | `@default(uuid())` |

---

## Related Skills

- [backend-skill.md](./backend-skill.md) — Service layer
- [architecture-skill.md](./architecture-skill.md) — ER diagrams
