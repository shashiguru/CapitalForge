# CapitalForge — Engineering Time Log

> **Version:** 1.0 · **Last updated:** 2026-05-24

---

## How AI Agents Should Use This Document

1. **Append an entry after every work session** — even small fixes.
2. Use the daily template below; one entry per day per agent/session.
3. Link feature IDs from `FEATURE_BACKLOG.md`.
4. Be honest about blockers — this feeds management reporting via `reporting-skill.md`.

---

## Daily Log Template

Copy and fill for each work session:

```markdown
### YYYY-MM-DD — [Agent/Developer] — [Brief session title]

| Field | Value |
|-------|-------|
| **Feature(s)** | F-0XX, F-0YY |
| **Estimated** | Xh |
| **Actual** | Xh |
| **Outcome** | [Completed / Partial / Blocked] |

**Work performed:**
- [Bullet list of what was done]

**Blockers:**
- [None / describe]

**Next actions:**
- [ ] [Specific next step]
- [ ] [Update FEATURE_BACKLOG if status changed]
```

---

## Weekly Summary Template

Copy at end of each week:

```markdown
## Week YYYY-WXX Summary

| Metric | Value |
|--------|-------|
| Total hours | XX |
| Features completed | F-XXX, F-YYY |
| Features in progress | F-ZZZ |
| Blockers resolved | N |
| Open blockers | [list] |

**Highlights:**
- ...

**Carry-over to next week:**
- ...
```

---

## Log Entries

### 2026-05-24 — Agent — Project Operating System Setup

| Field | Value |
|-------|-------|
| **Feature(s)** | Infrastructure |
| **Estimated** | 2h |
| **Actual** | 2h |
| **Outcome** | Completed |

**Work performed:**
- Created `project-operating-system/` with docs, skills, and Cursor rules
- Documented architecture, backlog, decisions, API contracts from existing codebase
- Established agent workflows and cross-references

**Blockers:**
- None

**Next actions:**
- [ ] Copy or symlink `.cursor/rules` to repo root for Cursor auto-loading
- [ ] Begin F-001 strategy engine multiplier rewrite
- [ ] Remove AuthBypassMiddleware (F-003)

---

### 2026-05-23 — Developer — Schema migration for multipliers

| Field | Value |
|-------|-------|
| **Feature(s)** | F-001, F-009 |
| **Estimated** | 3h |
| **Actual** | 4h |
| **Outcome** | Partial |

**Work performed:**
- Migrated StrategyRule to use `buyMultiplier` and `weeklyDipMultiplier`
- Added `isAggressive`, `fiftyTwoWeekHigh` to Allocation
- Added per-portfolio bucket ratios and `dcaWeeksPerYear`
- Added Investor model

**Blockers:**
- strategy.service.ts still uses legacy equal-split logic

**Next actions:**
- [ ] Rewrite `generateStrategy()` per PRD §5.2
- [ ] Update seed.ts to use multipliers

---

### 2026-05-20 — Developer — PWA service worker

| Field | Value |
|-------|-------|
| **Feature(s)** | F-017 |
| **Estimated** | 2h |
| **Actual** | 1.5h |
| **Outcome** | Partial |

**Work performed:**
- Added service worker with network-first strategy
- Registered SW in frontend
- Added manifest icons

**Blockers:**
- Offline strategy page untested

**Next actions:**
- [ ] Test offline behavior on strategy page
- [ ] Verify API routes are excluded from SW cache

---

## Monthly Rollup Template

```markdown
## Month YYYY-MM Rollup

| Week | Hours | Features Done | Notes |
|------|-------|---------------|-------|
| W19 | XX | F-019 | Market sync |
| W20 | XX | F-018 | Dashboard |
| W21 | XX | — | Strategy rewrite in progress |
| W22 | XX | — | |
| **Total** | **XX** | **N features** | |

**Velocity:** X features/sprint  
**Top blocker:** [description]  
**ROI note:** [business value delivered]
```

---

## Effort Categories

Use these tags in session titles for reporting:

| Tag | Description |
|-----|-------------|
| `[FEAT]` | New feature development |
| `[FIX]` | Bug fix |
| `[DEBT]` | Tech debt reduction |
| `[DOC]` | Documentation |
| `[INFRA]` | DevOps, deployment, tooling |
| `[TEST]` | Test writing |
| `[REVIEW]` | Code review |

---

## Related Documents

- [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md) — Feature status
- [reporting-skill.md](../skills/reporting-skill.md) — Management report generation
