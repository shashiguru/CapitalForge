# CapitalForge — Release Notes

> **Version:** 1.0 · **Last updated:** 2026-05-24

---

## How AI Agents Should Use This Document

- Add a new version entry when releasing to production.
- Categorize all changes using the categories below.
- Link feature IDs from `FEATURE_BACKLOG.md`.

---

## Release Template

Copy for each release:

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- [F-0XX] Description of new feature

### Changed
- Description of behavior change

### Fixed
- [BUG-0XX] Description of bug fix

### Deprecated
- Feature marked for removal

### Removed
- Feature removed

### Security
- Security-related changes

### Migration Notes
- Database migration steps if any
- Env var changes if any

### Breaking Changes
- None / describe
```

---

## Change Categories

| Category | Use For | Example |
|----------|---------|---------|
| **Added** | New features, endpoints, pages | Budget presets UI |
| **Changed** | Behavior changes, refactors visible to users | Weekly DCA now uses 48 weeks |
| **Fixed** | Bug fixes | Bucket remaining now decrements on execute |
| **Deprecated** | Features still working but scheduled for removal | `strategyReferenceBudget` field |
| **Removed** | Deleted features | Auth bypass middleware |
| **Security** | Auth, CORS, secret handling | JWT enforcement enabled |
| **Migration Notes** | DB migrations, env changes | Run `prisma migrate deploy` |
| **Breaking Changes** | API shape changes, removed endpoints | None expected in V1.x |

---

## Version History

### Version Scheme

```
MAJOR.MINOR.PATCH

MAJOR — Breaking API or data model changes
MINOR — New features, backward compatible
PATCH — Bug fixes, no new features
```

---

## [1.0.0] — 2026-04-01

### Added
- Initial production release
- Portfolio dashboard with P&L, allocation pie chart
- Strategy page with buy plan generation
- Allocation management with bucket breakdown
- Transaction ledger with CSV import
- Weekly budget tracking
- Analytics page (bucket usage, dip opportunities, timeseries)
- Market data sync via Yahoo Finance
- JWT authentication (register/login)
- Excel seed import from `Stocks Strategy.xlsx`
- Budget presets (save/apply yearly budgets)
- Core stocks management
- PWA service worker (basic offline support)

### Changed
- Migrated from env-based bucket ratios to per-portfolio DB fields

### Fixed
- CORS configuration for production frontend domain

### Migration Notes
- Run `npx prisma migrate deploy` on first deploy
- Set `NEXT_PUBLIC_API_URL` to Render backend URL

---

## [1.1.0] — Planned

### Added
- [F-001] Multiplier-based strategy rules
- [F-004] Budget Preview widget
- [F-005] Weekly Dip Buy intra-week trigger
- [F-009] Aggressive mode for ETFs (VONG)

### Changed
- [F-002] Auto-recalculate buckets on budget/ratio changes
- Strategy generate uses multiplier rules per PRD

### Fixed
- [F-007] executeBuyPlan bucket remaining decrement
- [F-006] Transaction edit/delete reversal logic
- [F-003] Remove JWT auth bypass

### Deprecated
- `strategyReferenceBudget` field (removed from Portfolio)

### Migration Notes
- Migration: StrategyRule multiplier fields
- Re-seed or migrate existing strategy rules
- Remove `AuthBypassMiddleware` from app module

### Breaking Changes
- StrategyRule API shape changed (multipliers instead of quantities)

---

## [1.2.0] — Planned

### Added
- [F-011] Multi-investor UI (Shashi/Lucky split)
- [F-012] Transaction pagination
- [F-013] CSV export
- [F-014] Add stock wizard
- [F-015] 52w high staleness warning

### Fixed
- [F-016] Performance chart daily values
- [F-010] 90-day price history retention

---

## Unreleased

Track work-in-progress here before versioning:

### In Progress
- Strategy engine multiplier rewrite (F-001, F-008)
- Schema migration for aggressive mode and investors
- Project Operating System documentation

### Known Issues
See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)

---

## Related Documents

- [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md) — Feature tracking
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) — Deploy procedures
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) — Release workflow
