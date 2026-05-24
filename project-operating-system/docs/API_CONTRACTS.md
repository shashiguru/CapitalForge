# CapitalForge — API Contracts

> **Version:** 1.0 · **Last updated:** 2026-05-24  
> **Base URL:** `{API_HOST}/api` (local: `http://localhost:3001/api`)

---

## How AI Agents Should Use This Document

- Reference endpoint paths and shapes before creating/modifying controllers or API client methods.
- Keep `frontend/src/lib/api.ts` in sync with backend routes.
- Follow error response structure exactly.
- Do not invent new response wrappers — success returns raw DTOs.

---

## Endpoint Conventions

| Convention | Rule |
|------------|------|
| **Prefix** | All routes under `/api` |
| **Resource naming** | Plural nouns: `/portfolios`, `/transactions` |
| **Nesting** | Portfolio-scoped: `/portfolios/:portfolioId/allocations` |
| **Actions** | POST for create/actions: `/strategy/generate`, `/market-data/sync` |
| **IDs** | UUID path params |
| **Methods** | GET (read), POST (create/action), PATCH (partial update), DELETE (remove) |

---

## Authentication Requirements

| Route Pattern | Auth |
|---------------|------|
| `POST /auth/register` | Public |
| `POST /auth/login` | Public |
| `GET /api/health` | Public |
| All other routes | Bearer JWT required |

**Header:**
```
Authorization: Bearer <accessToken>
```

**Login response:**
```json
{
  "accessToken": "eyJhbG...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

---

## Request/Response Patterns

### Success — Single resource

```
GET /api/portfolios/:id
→ 200 Portfolio
```

### Success — Collection

```
GET /api/portfolios/:id/allocations
→ 200 Allocation[]
```

### Success — Action

```
POST /api/portfolios/:id/strategy/generate
→ 201 StrategySnapshot
```

### Create

```
POST /api/portfolios
Content-Type: application/json

{ "name": "My Portfolio", "totalCapital": 23639 }

→ 201 Portfolio
```

### Partial update

```
PATCH /api/portfolios/:id
{ "totalCapital": 28000 }

→ 200 Portfolio
```

---

## Error Response Structure

All errors follow this envelope (via `AllExceptionsFilter`):

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    "targetPercentage must not be greater than 100",
    "coreRatio + dipRatio + crashRatio must equal 1"
  ],
  "timestamp": "2026-05-24T12:00:00.000Z"
}
```

| Status | When |
|--------|------|
| 400 | Validation failure, bad request |
| 401 | Missing/invalid JWT |
| 403 | Forbidden (future: portfolio ownership) |
| 404 | Resource not found |
| 409 | Conflict (duplicate symbol, etc.) |
| 500 | Unhandled server error |

**Validation errors:** `message` may be a string or array of constraint messages.

---

## API Versioning Standards

**V1:** No version prefix. All routes at `/api/...`.

**Future:** If breaking changes needed, introduce `/api/v2/...` alongside v1. Document migration in `DECISION_LOG.md`.

---

## Pagination Standards

**Current state:** Most list endpoints return full collections.

**Target standard (F-012):**

```
GET /api/portfolios/:id/transactions?page=1&pageSize=50

→ 200 {
  "data": Transaction[],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "total": 247,
    "totalPages": 5
  }
}
```

**Query params:**
| Param | Type | Default | Max |
|-------|------|---------|-----|
| `page` | int | 1 | — |
| `pageSize` | int | 50 | 100 |

---

## Endpoint Catalog

### Auth

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/auth/register` | `{ email, password, name? }` | `AuthResponse` |
| POST | `/auth/login` | `{ email, password }` | `AuthResponse` |
| GET | `/auth/profile` | — | `User` |
| PATCH | `/auth/profile` | `{ name?, currentPassword?, newPassword? }` | `User` |

### Portfolios

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/portfolios` | — | `Portfolio[]` |
| POST | `/portfolios` | `CreatePortfolioDto` | `Portfolio` |
| GET | `/portfolios/:id` | — | `Portfolio` |
| PATCH | `/portfolios/:id` | `Partial<CreatePortfolioDto>` | `Portfolio` |
| DELETE | `/portfolios/:id` | — | 204 |
| GET | `/portfolios/:id/summary` | — | `PortfolioSummary` |

### Budget Presets

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/portfolios/:id/budget-presets` | — | `BudgetPreset[]` |
| POST | `/portfolios/:id/budget-presets` | `{ name, totalCapital, budgetYearStart?, budgetYearEnd? }` | `BudgetPreset` |
| PATCH | `/portfolios/:id/budget-presets/:presetId` | Partial | `BudgetPreset` |
| POST | `/portfolios/:id/budget-presets/:presetId/apply` | — | `Portfolio` |
| DELETE | `/portfolios/:id/budget-presets/:presetId` | — | 204 |

### Allocations

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/portfolios/:id/allocations` | — | `Allocation[]` |
| GET | `/portfolios/:id/allocations/summary` | — | `AllocationSummary` |
| POST | `/portfolios/:id/allocations` | `CreateAllocationDto` | `Allocation` |
| POST | `/portfolios/:id/allocations/bulk` | `{ symbol, targetPercentage }[]` | `Allocation[]` |
| POST | `/portfolios/:id/allocations/recalculate` | — | 200 |
| PATCH | `/allocations/:id` | Partial | `Allocation` |
| DELETE | `/allocations/:id` | — | 204 |

**CreateAllocationDto example:**
```json
{
  "symbol": "NVDA",
  "companyName": "NVIDIA Corporation",
  "targetPercentage": 25,
  "isAggressive": false,
  "fiftyTwoWeekHigh": 950.00
}
```

### Strategy

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/portfolios/:id/strategy/generate` | `{ weeklyBudget? }` | `StrategySnapshot` |
| GET | `/portfolios/:id/strategy/snapshots` | — | `StrategySnapshot[]` |
| GET | `/portfolios/:id/strategy/snapshots/:snapshotId` | — | `StrategySnapshot` |
| GET | `/portfolios/:id/strategy/table` | — | `PortfolioStrategyTable` |
| GET | `/portfolios/:id/strategy/rules` | — | `StoredStrategyRules` |
| PUT | `/portfolios/:id/strategy/rules` | `{ symbol, dipPercent, buyMultiplier, weeklyDipMultiplier? }` | 200 |
| POST | `/buy-plans/:id/approve` | `{ approved: boolean }` | `BuyPlan` |
| POST | `/buy-plans/:id/execute` | `{ executedPrice?, executedQuantity? }` | `BuyPlan` |

### Market Data

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/market-data/sync` | `{ symbols: string[], portfolioId? }` | `SyncResult` |
| GET | `/market-data/prices/:symbol` | — | Price data |
| GET | `/market-data/summary/:symbol` | — | `MarketDataSummary` |
| POST | `/market-data/summary/batch` | `{ symbols: string[] }` | `MarketDataSummary[]` |

### Budget (Weekly)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/portfolios/:id/budgets` | — | `WeeklyBudget[]` |
| GET | `/portfolios/:id/budgets/current` | — | `WeeklyBudget \| null` |
| GET | `/portfolios/:id/budgets/summary` | — | `BudgetSummary` |
| POST | `/portfolios/:id/budgets` | `CreateBudgetDto` | `WeeklyBudget` |
| PATCH | `/budgets/:id` | Partial | `WeeklyBudget` |

### Transactions

| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET | `/portfolios/:id/transactions` | `symbol?, type?, startDate?, endDate?` | `Transaction[]` |
| GET | `/portfolios/:id/transactions/summary` | — | `TransactionSummary` |
| POST | `/portfolios/:id/transactions` | `CreateTransactionDto` | `Transaction` |
| POST | `/portfolios/:id/transactions/import` | `{ transactions: CreateTransactionDto[] }` | `Transaction[]` |
| PATCH | `/transactions/:id` | Partial | `Transaction` |
| DELETE | `/transactions/:id` | — | 204 |

**CreateTransactionDto example:**
```json
{
  "symbol": "NVDA",
  "type": "BUY",
  "price": 170.50,
  "quantity": 0.4337,
  "date": "2026-05-20",
  "notes": "Weekly DCA"
}
```

### Analytics

| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET | `/portfolios/:id/analytics` | — | `PortfolioAnalytics` |
| GET | `/portfolios/:id/analytics/allocation-chart` | — | `AllocationChartData[]` |
| GET | `/portfolios/:id/analytics/bucket-usage` | — | `BucketUsage[]` |
| GET | `/portfolios/:id/analytics/timeseries` | `days=90` | `PortfolioTimeseries[]` |
| GET | `/portfolios/:id/analytics/weekly-transactions` | `weeks=12` | Timeseries |
| GET | `/portfolios/:id/analytics/dip-opportunities` | — | `DipOpportunity[]` |
| GET | `/portfolios/:id/analytics/performance` | `days?` | Performance data |
| GET | `/portfolios/:id/analytics/allocation-rebalance` | — | `AllocationRebalance` |

### Core Stocks

| Method | Path | Response |
|--------|------|----------|
| GET | `/portfolios/:id/core-stocks` | `{ symbol, displayName }[]` |

### Health

| Method | Path | Response |
|--------|------|----------|
| GET | `/health` | `{ "status": "ok" }` |

---

## DTO Validation Rules (Key)

| Field | Rules |
|-------|-------|
| `email` | Valid email format |
| `password` | Min 8 characters |
| `targetPercentage` | 0–100, sum ≤ 100 across portfolio |
| `coreRatio + dipRatio + crashRatio` | Must equal 1.0 |
| `buyMultiplier` | Integer: 1, 3, or 5 |
| `dipPercent` | Integer: 10, 15, 20, 30 |
| `type` (transaction) | Enum: BUY, SELL, DIVIDEND, FEE |
| `totalCapital` | Positive decimal |

---

## Frontend API Client Mapping

All methods in `frontend/src/lib/api.ts`:

| Client Object | Backend Module |
|---------------|----------------|
| `authApi` | `auth/` |
| `portfolioApi` | `portfolio/` |
| `allocationApi` | `allocation/` |
| `marketDataApi` | `market-data/` |
| `strategyApi` | `strategy/` |
| `budgetApi` | `budget/` |
| `transactionApi` | `transaction/` |
| `analyticsApi` | `analytics/` |
| `coreStockApi` | `core-stock/` |

**Rule:** Add new endpoints to both backend controller AND `api.ts` in the same PR.

---

## Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) — API flow diagrams
- [backend-skill.md](../skills/backend-skill.md) — API design principles
- [frontend/src/lib/api.ts](../../frontend/src/lib/api.ts) — Client implementation
