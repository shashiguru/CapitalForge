# Code Review Skill — CapitalForge

> Reusable AI operating instructions for PR review and quality assurance.

## When to Use

Load when reviewing PRs, self-reviewing before submit, or auditing code changes.

---

## PR Review Checklist

### Scope & Context
```
□ PR addresses a single feature/fix (one F-0XX item)
□ FEATURE_BACKLOG.md updated
□ TIME_LOG.md entry added
□ No unrelated refactors or drive-by changes
□ DECISION_LOG.md updated if architectural
```

### Correctness
```
□ Business logic matches PRD (especially budget derivation chain)
□ Multipliers used (not raw share quantities) for strategy
□ Decimal used for money (not JS number)
□ Bucket ratios sum to 1.0
□ Transaction side effects correct (or reversal implemented)
□ Edge cases handled (zero budget, exhausted bucket, missing 52w high)
```

### Security Checks
```
□ No secrets in code (.env values, JWT secrets, DB URLs)
□ Auth guard on new endpoints (unless @Public())
□ No AuthBypassMiddleware added/enabled
□ Input validated via DTOs (class-validator)
□ No raw SQL / SQL injection vectors
□ CORS not widened unnecessarily
□ Password not logged or returned in responses
```

### Performance Checks
```
□ No N+1 queries (check Prisma includes in loops)
□ Select only needed fields from DB
□ No unnecessary API calls from frontend
□ Large lists paginated (or noted as tech debt)
□ Yahoo Finance calls batched where possible
```

### Maintainability Checks
```
□ Follows existing module structure (controller/service/dto)
□ API methods added to lib/api.ts (not scattered axios)
□ Types in lib/types.ts match backend DTOs
□ Naming consistent with codebase conventions
□ No over-abstraction (no premature helpers)
□ Comments only for non-obvious business logic
```

### Scalability Checks
```
□ No in-memory state that breaks multi-instance deploy
□ DB queries use indexed columns
□ No unbounded data fetch (all transactions without pagination)
□ Module boundaries respected (no cross-domain Prisma in wrong service)
```

---

## Refactoring Rules

| Rule | Rationale |
|------|-----------|
| **No drive-by refactors** | Reviewers can't verify unrelated changes |
| **Refactor only what you touch** | Minimize blast radius |
| **Behavior-preserving refactors only** in fix PRs | Separate refactor PRs from feature PRs |
| **Don't rename modules** without ADR | Breaks agent context and docs |
| **Don't change API shapes** without version bump | Breaks frontend |
| **Don't migrate patterns** (e.g., Context → Redux) without ADR | Consistency > preference |

**Allowed in any PR:**
- Extract function from method you modified
- Fix lint errors in files you touched
- Rename variable for clarity in scope of change

**Requires separate PR + ADR:**
- New dependency
- New module
- Auth mechanism change
- Database provider change
- State management library change

---

## Review by Layer

### Backend PR
```
□ DTO has validators
□ Service has business logic (not controller)
□ Prisma uses Decimal for money
□ Errors use NestJS exceptions (NotFoundException, etc.)
□ New routes documented in API_CONTRACTS.md
□ Tests added for new logic
```

### Frontend PR
```
□ Uses lib/api.ts methods
□ ProtectedRoute on auth pages
□ Loading/error states handled
□ Money formatted correctly
□ Responsive layout (mobile bottom tab bar)
□ No hardcoded URLs
```

### Database PR
```
□ Migration is forward-only
□ Indexes on FK columns
□ Decimal types for money
□ Seed updated if schema affects seed
□ No data loss in migration
```

---

## Severity Guide for Review Comments

| Level | Action | Example |
|-------|--------|---------|
| **Blocker** | Must fix before merge | Auth bypass, money as float, wrong formula |
| **Major** | Should fix before merge | Missing validation, no error handling |
| **Minor** | Fix or follow-up ticket | Naming, missing test, style |
| **Nit** | Optional | Formatting preference |

---

## Self-Review Before Submit

```bash
# Backend
cd backend && npm run lint && npm run build && npm test

# Frontend
cd frontend && npm run lint && npm run build

# Check diff scope
git diff main --stat
# Should be focused — flag if > 10 unrelated files
```

---

## Related Skills

- [backend-skill.md](./backend-skill.md)
- [frontend-skill.md](./frontend-skill.md)
- [testing-skill.md](./testing-skill.md)
- [architecture-skill.md](./architecture-skill.md)
