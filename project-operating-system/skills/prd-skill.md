# PRD Skill — CapitalForge

> Reusable AI operating instructions for writing and interpreting product requirements.

## When to Use

Load when writing new requirements, interpreting business logic, creating user stories, or validating implementation against spec.

**Source of truth:** `PRD.md` at repo root (v1.1, May 2026).

---

## PRD Writing Standards

### Document Structure

```markdown
# [Feature/Module] — Requirements

## Background
[Why this exists, link to business problem]

## Goal
[One sentence outcome]

## User Stories
[Table format — see below]

## Functional Requirements
[Numbered FR-XX, testable statements]

## Non-Functional Requirements
[Performance, security, reliability]

## Logic Specification
[Formulas, decision tables, pseudocode]

## Data Model Changes
[Schema additions/modifications]

## UI / Screen Map
[Which pages affected]

## Implementation Gaps
[Current vs desired state]

## Out of Scope
[Explicit exclusions]
```

---

## User Story Format

```markdown
| ID | As a [role] I want to [action] | So that [benefit] |
```

**CapitalForge example:**
```markdown
| US-06 | As a user I want to change the yearly budget and immediately see updated weekly buy targets | So that adjusting investment pace takes one number, not re-doing the spreadsheet |
```

**Rules:**
- Role is always "user" (or "investor" for multi-investor features)
- Action is specific and testable
- Benefit ties to business outcome, not technical detail
- One story = one capability

---

## Acceptance Criteria Standards

Each user story or feature needs acceptance criteria:

```markdown
### US-XX Acceptance Criteria

- [ ] Given [precondition], when [action], then [outcome]
- [ ] Given totalBudget=$23,639, when user views NVDA 10% dip buy, then amount shows $73.87 (±$0.01)
- [ ] Given user changes budget to $30,000, when strategy table renders, then all buy amounts update without page reload
- [ ] Edge case: Given bucket exhausted, when buy signal generated, then no buy plan created for that bucket
```

**Rules:**
- Use Given/When/Then format
- Include exact values from Excel where applicable
- Cover happy path + 2 edge cases minimum
- Criteria must be verifiable without interpretation

---

## Functional Requirements Structure

```markdown
- **FR-XX**: [Subject] [must/shall] [behavior]. [Optional: formula or constraint]
```

**Examples from CapitalForge PRD:**
```markdown
- **FR-08**: allocationUSD = totalBudget × targetPercent / 100 (always computed, never manually entered)
- **FR-13**: buyUSD = stock.weeklyDCA × multiplier; buyShares = floor(buyUSD / currentPrice)
- **FR-32**: On BUY: sharesOwned += qty, avgCostBasis recalculated, bucket usedUSD += total
```

**Numbering:** Continue from last FR in PRD (currently FR-48).

---

## Non-Functional Requirements Structure

| Category | Template |
|----------|----------|
| Performance | [Action] completes in < [N] seconds for [condition] |
| Data accuracy | All monetary calculations use Decimal with ≥ 2dp precision |
| Reliability | [External service] failures are graceful — [fallback behavior] |
| Security | [Resource] requires [auth method] |
| Audit | Every [action] is timestamped and [retained/logged] |

---

## Logic Specification Format

For decision engines, always include:

1. **Derivation chain** (formula cascade)
2. **Decision tables** (dip levels, multipliers)
3. **Pseudocode** for complex logic
4. **Edge cases** (exhausted buckets, null 52w high)

**Example (from PRD §5.2):**
```
function getBuyAmount(stock, dipPercent, currentPrice):
  multiplier = lookupMultiplier(stock.isAggressive, dipPercent)
  buyUSD = stock.weeklyDCA × multiplier
  buyShares = floor(buyUSD / currentPrice)
  return { buyUSD, buyShares, multiplier }
```

---

## Mapping Requirements to Code

| PRD Section | Code Location |
|-------------|---------------|
| §3 Budget derivation | `allocation.service.ts` → `recalculateBuckets()` |
| §5.2 Buy amount | `strategy.service.ts` → `getBuyAmount()` |
| §5.3 Bucket selection | `strategy.service.ts` → `selectBucket()` |
| §5.4 Weekly dip | `strategy.service.ts` → `isWeeklyDipTriggered()` |
| §4.8 Transactions | `transaction.service.ts` |
| §4.9 Analytics | `analytics.service.ts` |
| §8 Gaps | `FEATURE_BACKLOG.md`, `KNOWN_ISSUES.md` |

---

## Validating Implementation Against PRD

```
□ Read relevant FR-XX and US-XX
□ Trace formula in code — match PRD exactly
□ Test with Excel fixture values ($73.87, $221.62, $369.36)
□ Check gap table (PRD §8) — is this gap being closed?
□ Verify out-of-scope items not included
□ Update FEATURE_BACKLOG acceptance criteria checkboxes
```

---

## Adding New Requirements

1. Add user story to PRD §4 (or new section)
2. Add numbered FR-XX to PRD §5
3. Add row to `FEATURE_BACKLOG.md`
4. Add gap row to PRD §8 if fixing existing deficiency
5. If architectural, add ADR to `DECISION_LOG.md`

---

## Related Documents

- [PRD.md](../../PRD.md) — Full product requirements
- [FEATURE_BACKLOG.md](../docs/FEATURE_BACKLOG.md) — Implementation tracking
- [PROJECT_CONTEXT.md](../docs/PROJECT_CONTEXT.md) — Business rules summary
