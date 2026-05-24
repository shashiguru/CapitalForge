# Testing Skill — CapitalForge

> Reusable AI operating instructions for testing strategy and implementation.

## When to Use

Load when writing tests, setting up test infrastructure, or verifying feature correctness.

---

## Current State

| Layer | Framework | Coverage |
|-------|-----------|----------|
| Backend unit | Jest + ts-jest | Minimal — strategy engine untested |
| Backend e2e | Jest + supertest | Config exists, few tests |
| Frontend | None | Lint + build only |

**Priority:** Strategy engine unit tests with Excel parity fixtures.

---

## Unit Testing Strategy (Backend)

**Target files:**
- `strategy.service.ts` — buy amount calculation, dip classification, bucket selection
- `allocation.service.ts` — bucket recalculation, budget derivation chain
- `transaction.service.ts` — side effects, reversal logic

**Pattern:**
```typescript
// strategy.service.spec.ts
describe('StrategyService', () => {
  describe('getBuyAmount', () => {
    it('should compute NVDA 10% dip as 1x weeklyDCA', () => {
      // Given: totalBudget=23639, targetPercent=25, coreRatio=0.6, weeks=48
      // weeklyDCA = 23639 * 0.25 * 0.6 / 48 = 73.87 (approx)
      const result = service.getBuyAmount(allocation, 10, currentPrice);
      expect(result.buyUSD.toNumber()).toBeCloseTo(73.87, 2);
      expect(result.multiplier).toBe(1);
    });

    it('should use 3x multiplier at 20% dip for normal stocks', () => {
      const result = service.getBuyAmount(allocation, 25, currentPrice);
      expect(result.multiplier).toBe(3);
    });
  });
});
```

**Excel parity fixtures** (from PRD):
```typescript
const EXCEL_FIXTURES = {
  totalBudget: 23639,
  nvda: {
    targetPercent: 25,
    weeklyDCA: 73.87,
    buyAt10Pct: 73.87,   // 1x
    buyAt20Pct: 221.62,  // 3x
    buyAt30Pct: 369.36,  // 5x
  },
};
```

---

## Integration Testing

Test service + Prisma together with test database:

```typescript
// Use separate test DB or SQLite (if compatible)
beforeEach(async () => {
  await prisma.transaction.deleteMany();
  await prisma.allocation.deleteMany();
  // seed minimal portfolio
});

it('should recalculate buckets when budget changes', async () => {
  await portfolioService.update(portfolioId, { totalCapital: 30000 });
  const allocation = await allocationService.findOne(allocationId);
  expect(allocation.weeklyDCA).toBeCloseTo(expected, 2);
});
```

---

## E2E Testing

```bash
cd backend
npm run test:e2e
```

**Key flows to test:**
1. Register → Login → Get profile
2. Create portfolio → Add allocation → Recalculate
3. Generate strategy → Verify buy plans
4. Record transaction → Verify allocation updated

```typescript
it('/api/auth/login (POST)', () => {
  return request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: 'demo@capitalforge.com', password: 'password123' })
    .expect(201)
    .expect(res => {
      expect(res.body.accessToken).toBeDefined();
    });
});
```

---

## Frontend Testing (Future)

Recommended: Vitest + React Testing Library

**Priority tests:**
- Budget preview calculation (pure function)
- API client error handling (401 redirect)
- ProtectedRoute redirects unauthenticated users

---

## Mocking Standards

| Dependency | Mock Strategy |
|------------|---------------|
| PrismaService | Use test DB or jest.mock with in-memory |
| Yahoo Finance | Mock market-data.service responses |
| JWT | Use test token or bypass guard in test module |
| Date/time | jest.useFakeTimers for weekly dip tests |

**Do not mock** the code under test. Mock external boundaries only.

---

## Coverage Expectations

| Module | Target | Priority |
|--------|--------|----------|
| strategy.service | 80%+ | P0 |
| allocation.service | 70%+ | P0 |
| transaction.service | 70%+ | P1 |
| Controllers | 50%+ | P2 |
| Frontend utils | 60%+ | P2 |
| **Overall** | 60%+ | Incremental |

Run: `npm run test:cov` in backend.

---

## Test Naming Convention

```
describe('[Class/Function]', () => {
  describe('[method/scenario]', () => {
    it('should [expected behavior] when [condition]', () => {});
  });
});
```

---

## Pre-PR Test Checklist

```
□ New logic has unit tests
□ Excel parity values verified for strategy changes
□ Existing tests pass (npm test)
□ Frontend builds (npm run build)
□ Manual smoke test documented in PR
```

---

## Related Skills

- [backend-skill.md](./backend-skill.md) — Service patterns
- [code-review-skill.md](./code-review-skill.md) — Review test quality
- [debugging-skill.md](./debugging-skill.md) — When tests fail
