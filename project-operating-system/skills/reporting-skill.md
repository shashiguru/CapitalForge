# Reporting Skill — CapitalForge

> Reusable AI operating instructions for management reports, sprint summaries, and engineering metrics.

## When to Use

Load when generating weekly summaries, sprint reports, ROI analysis, or productivity metrics for stakeholders.

## Data Sources

| Source | Contains |
|--------|----------|
| `docs/TIME_LOG.md` | Daily hours, outcomes, blockers |
| `docs/FEATURE_BACKLOG.md` | Feature status, priorities, sprint tracking |
| `docs/DECISION_LOG.md` | Architectural decisions |
| `docs/KNOWN_ISSUES.md` | Open bugs, tech debt |
| `docs/RELEASE_NOTES.md` | Shipped features |
| `PRD.md` | Business requirements, gap analysis |

---

## Weekly Engineering Summary Template

```markdown
# CapitalForge — Engineering Summary
**Week:** YYYY-WXX (Mon DD – Sun DD, YYYY)
**Prepared by:** [Agent/Developer]
**Date:** YYYY-MM-DD

## Executive Summary
[2-3 sentences: what shipped, what's blocked, overall health]

## Sprint Progress

| Metric | Planned | Actual |
|--------|---------|--------|
| Features committed | N | N |
| Features completed | — | N |
| Hours logged | — | XX |
| Blockers resolved | — | N |

## Completed This Week
| Feature | ID | Business Value |
|---------|-----|----------------|
| [Name] | F-0XX | [Impact in plain language] |

## In Progress
| Feature | ID | Progress | ETA |
|---------|-----|----------|-----|
| [Name] | F-0XX | XX% | WXX |

## Blockers
| Blocker | Impact | Owner | Resolution Path |
|---------|--------|-------|-----------------|
| [Description] | High/Med/Low | — | [Action] |

## Risks
| Risk | Status | Mitigation |
|------|--------|------------|
| [From FEATURE_BACKLOG risk register] | Active/Mitigated | [Action] |

## Next Week Plan
1. [Priority 1]
2. [Priority 2]
3. [Priority 3]

## Metrics
- Open P0 bugs: N
- Open P1 bugs: N
- Tech debt items: N
- Test coverage: XX% (backend)
```

---

## Sprint Summary Template

```markdown
# Sprint YYYY-WXX Retrospective

## Goal
[From FEATURE_BACKLOG sprint section]

## Delivered vs Committed
| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F-001 | Multiplier strategy | Done/Partial/Missed | |

## Velocity
- Story points / features: X/Y
- Hours: XX actual vs XX estimated
- Carry-over: [list]

## What Went Well
- ...

## What Didn't Go Well
- ...

## Action Items
- [ ] ...
```

---

## ROI Reporting Template

Connect engineering effort to business value:

```markdown
# ROI Report — [Period]

## Business Problem
Manual Excel workflow for portfolio management costs ~X hours/week in recalculation and error correction.

## Solution Delivered
| Capability | Before (Excel) | After (CapitalForge) | Time Saved |
|------------|----------------|---------------------|------------|
| Weekly buy calculation | 30 min manual | Instant | 30 min/week |
| Budget change propagation | 2 hours re-work | 1 click | 2 hours/event |
| Transaction audit | Manual ledger | Automated | 15 min/week |

## Investment
| Period | Engineering Hours | Estimated Cost |
|--------|-------------------|----------------|
| [Month] | XX | $XX (if applicable) |

## Return
- **Quantifiable:** XX hours/month saved
- **Qualitative:** Reduced calculation errors, real-time buy signals, audit trail

## Upcoming Value (Pipeline)
| Feature | Expected ROI |
|---------|-------------|
| F-004 Budget Preview | Eliminates trial-and-error budget planning |
| F-005 Weekly Dip | Captures intra-week opportunities automatically |
```

---

## Productivity Reporting

```markdown
# Productivity Report — [Period]

## Output Metrics
| Metric | Value |
|--------|-------|
| PRs merged | N |
| Features completed | N |
| Bugs fixed | N |
| Lines changed (net) | +XXX / -XXX |

## Efficiency Metrics
| Metric | Value | Target |
|--------|-------|--------|
| Avg hours per feature | X | < 8 |
| Blocked time % | X% | < 15% |
| Rework rate (reopened items) | X% | < 10% |

## Focus Distribution
| Category | Hours | % |
|----------|-------|---|
| Feature development | XX | XX% |
| Bug fixes | XX | XX% |
| Tech debt | XX | XX% |
| Documentation | XX | XX% |
```

---

## Risk Reporting Template

```markdown
# Risk Report — [Date]

## Critical Risks (Immediate Action)
| Risk | Impact | Likelihood | Mitigation | Owner |
|------|--------|------------|------------|-------|

## Medium Risks (Monitor)
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|

## Resolved Since Last Report
| Risk | Resolution |
|------|------------|
```

---

## How to Generate Reports

1. Read `TIME_LOG.md` for the week's entries
2. Read `FEATURE_BACKLOG.md` for status changes
3. Count open items in `KNOWN_ISSUES.md` by severity
4. Check `RELEASE_NOTES.md` for shipped versions
5. Fill appropriate template above
6. Save report or present to user

**Cadence recommendation:**
- Weekly summary: every Friday
- Sprint retrospective: end of each 2-week sprint
- ROI report: monthly
- Risk report: bi-weekly or on demand

---

## Related Documents

- [TIME_LOG.md](../docs/TIME_LOG.md)
- [FEATURE_BACKLOG.md](../docs/FEATURE_BACKLOG.md)
