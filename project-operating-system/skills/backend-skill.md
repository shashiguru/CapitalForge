# Backend Skill — CapitalForge

> Reusable AI operating instructions for NestJS backend work.

## When to Use

Load when modifying controllers, services, DTOs, guards, or Prisma queries in `backend/src/`.

## Prerequisites

1. Read `docs/PROJECT_CONTEXT.md` — especially budget derivation chain
2. Read `docs/API_CONTRACTS.md` — endpoint conventions
3. Check `docs/KNOWN_ISSUES.md` — avoid reintroducing fixed bugs

---

## API Design Principles

- **RESTful resources** under `/api/portfolios/:id/...`
- **One controller per module** — thin controllers, fat services
- **DTOs for all inputs** — class-validator decorators
- **Success:** return raw DTO (no wrapper)
- **Errors:** global filter returns `{ success: false, statusCode, message, errors, timestamp }`
- **Idempotent deletes:** return 204 No Content
- **Actions as POST sub-routes:** `/strategy/generate`, `/allocations/recalculate`

---

## Service Structure

```
domain/
├── domain.module.ts       # imports, exports service
├── domain.controller.ts   # HTTP layer only
├── domain.service.ts      # business logic
└── dto/
    └── domain.dto.ts      # CreateDto, UpdateDto with validators
```

**Controller responsibilities:**
- Route mapping
- Param extraction
- Call service method
- Return response

**Service responsibilities:**
- Business logic
- Prisma queries
- Decimal arithmetic
- Cross-module orchestration (inject other services)

**Never:** Put Prisma queries directly in controllers.

---

## Validation Rules

Global `ValidationPipe` config (already set in `main.ts`):
- `whitelist: true` — strip unknown properties
- `forbidNonWhitelisted: true` — reject unknown properties
- `transform: true` — auto-transform types

**DTO example:**
```typescript
import { IsString, IsNumber, Min, Max } from 'class-validator';

export class CreateAllocationDto {
  @IsString()
  symbol: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  targetPercentage: number;

  @IsOptional()
  @IsBoolean()
  isAggressive?: boolean;
}
```

**Portfolio-level validation:**
- `coreRatio + dipRatio + crashRatio === 1.0`
- Sum of `targetPercentage` across active allocations ≤ 100

---

## Error Handling

```typescript
// Not found
throw new NotFoundException(`Portfolio ${id} not found`);

// Business rule violation
throw new BadRequestException('Bucket ratios must sum to 1.0');

// Conflict
throw new ConflictException(`Allocation for ${symbol} already exists`);
```

Unhandled errors → `AllExceptionsFilter` → 500 with logged stack.

---

## Logging Standards

```typescript
import { Logger } from '@nestjs/common';

export class StrategyService {
  private readonly logger = new Logger(StrategyService.name);

  async generateStrategy(portfolioId: string) {
    this.logger.log(`Generating strategy for portfolio ${portfolioId}`);
    try {
      // ...
    } catch (error) {
      this.logger.error(`Strategy generation failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
```

| Level | Use |
|-------|-----|
| `log` | Normal operations (sync, generate) |
| `warn` | Degraded behavior (Yahoo retry, fallback) |
| `error` | Failures with stack trace |
| `debug` | Verbose (dev only) |

**Never log:** passwords, JWT tokens, DATABASE_URL.

---

## Security Standards

- `@Public()` only on register/login
- `JwtAuthGuard` on all other routes (when bypass removed)
- Verify portfolio belongs to authenticated user (future: enforce userId check)
- bcrypt for password hashing (cost factor 10+)
- CORS restricted to known origins
- No raw SQL — use Prisma parameterized queries only

---

## Scalability Standards

- Keep services stateless (no in-memory caches in V1)
- Use Prisma `select` to fetch only needed fields
- Batch Yahoo Finance calls where possible
- Index-aware queries — filter on indexed columns (`portfolioId`, `symbol`, `date`)
- Use `$transaction` for multi-table updates (transaction + allocation)

---

## Money Handling (Critical)

```typescript
import { Decimal } from '@prisma/client/runtime/library';

// Always use Decimal for money
const weeklyDCA = allocation.coreBucketUSD.div(portfolio.dcaWeeksPerYear);
const buyUSD = weeklyDCA.mul(rule.buyMultiplier);
const buyShares = buyUSD.div(currentPrice).floor();

// Never:
const buyUSD = Number(allocation.coreBucketUSD) * multiplier; // WRONG
```

---

## Module Boundaries

| Module | Owns | Must NOT |
|--------|------|----------|
| `strategy/` | Buy plan generation, snapshots, rules | Direct transaction creation |
| `transaction/` | Ledger CRUD, import | Strategy logic |
| `allocation/` | Bucket recalc, position tracking | Market data fetching |
| `market-data/` | Yahoo sync, PriceDaily | Portfolio business rules |
| `analytics/` | Read-only aggregations | State mutations |

Cross-module calls via injected services, not direct Prisma in wrong module.

---

## Strategy Engine Rules

When modifying `strategy.service.ts`:

1. Buy amount = `weeklyDCA × buyMultiplier` (NOT equal split)
2. Bucket selection per PRD §5.3 (Core/Dip/Crash with fallback)
3. Dip classification per PRD §5.5
4. Aggressive mode uses different multiplier table
5. Create snapshot + buy plans atomically

---

## Anti-Patterns

| Anti-Pattern | Do Instead |
|--------------|------------|
| JS number for money | Prisma Decimal |
| Logic in controller | Move to service |
| New module for one endpoint | Extend existing module |
| Env vars for per-portfolio config | DB fields on Portfolio |
| Storing computed buy amounts in rules | Store multipliers only |
| Skipping DTO validation | Always use class-validator |

---

## Related Skills

- [database-skill.md](./database-skill.md) — Schema, migrations
- [architecture-skill.md](./architecture-skill.md) — System design
- [debugging-skill.md](./debugging-skill.md) — Investigation
