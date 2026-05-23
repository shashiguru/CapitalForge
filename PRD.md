# CapitalForge — Product Requirements Document

**Version:** 1.1  
**Date:** May 2026  
**Status:** Draft

---

## 1. Background & Goal

The user currently manages a stock investment portfolio in `Stocks Strategy.xlsx`.  
The spreadsheet tracks:

- How capital is distributed across 5–6 stocks
- When to buy more shares (based on how far a stock has fallen from its 52-week high)
- How much to buy at each dip level
- Transaction history
- Current position performance

**Goal:** Replace the manual spreadsheet workflow with a web application that automates data entry, computes decisions in real-time, and keeps an audit-trail of all trades.

---

## 2. Excel Logic — Source of Truth

### Sheet 1 — "Stockes Allocations" (Capital Distribution)

| Field | Rule |
|---|---|
| **Total Budget** | Fixed yearly amount (e.g. $23,639). Shared across 2 investors (Shashi + Lucky). |
| **Allocation (%)** | Target % per stock. Must sum to ≤ 100%. |
| **Allocation (USD)** | `totalBudget × allocationPercent / 100` |
| **Core DCA (60%)** | `allocationUSD × 0.60` — reserved for regular weekly buys |
| **Monthly DCA** | `coreDCA / 12` |
| **Weekly DCA** | `coreDCA / 48` (48 trading weeks per year, not 52) |
| **Dip Buy (~30%)** | `allocationUSD × 0.30` — deployed during 20%+ dips |
| **Crash Buy (~10%)** | `allocationUSD × 0.10` — deployed during 30%+ crashes |

> **Note on ratios:** The column headers in the Excel say "Dip Buy (20%)" and "Crash Buy (4%)" — these are the *trigger thresholds* (20% dip triggers dip buy, 30%+ triggers crash buy), **not** the bucket sizes. The actual bucket sizes computed from the data are **60 / 30 / 10**, which sum to 100%. The current backend `.env` has 0.6 / 0.2 / 0.04 (sums to 0.84), which is a **gap** to fix.

---

### Sheet 2 — "Strategy" (Weekly Decision Rules)

This is the core decision engine. For each stock and each dip level, the sheet stores:

| Column | Meaning |
|---|---|
| **52-Week High** | The reference price. Entered manually when the strategy is designed. |
| **Threshold (USD)** | `52wHigh × (1 − dipPercent / 100)` — buy if current price ≤ this |
| **Buy (USD)** | Amount to deploy this week if the threshold is breached |
| **Weekly Dip (USD)** | *Additional* buy triggered when price drops >3–4% from your purchase price that same week |

#### Dip Level Grid

| Dip from 52w High | Level | NVDA / PLTR / SOFI / FTNT Buy | VONG Buy | Weekly Dip Trigger |
|---|---|---|---|---|
| < 10% | Normal | 1× weeklyDCA (Core bucket) | 1× weeklyDCA (Core) | None |
| 10 – 15% | Light Dip | 1× weeklyDCA (Core) | 1× weeklyDCA (Core) | None |
| 15 – 20% | Moderate Dip | 1× weeklyDCA (Core) | **3× weeklyDCA (Dip bucket)** | VONG only: +1× weeklyDCA |
| 20 – 30% | Dip | **3× weeklyDCA (Dip bucket)** | **5× weeklyDCA (Dip bucket)** | None (individual stocks) |
| ≥ 30% | Crash | **5× weeklyDCA (Crash bucket)** | **5× weeklyDCA (Crash bucket)** | +1× weeklyDCA (all stocks) |
| > 30% (same rule) | Crash+ | Same as 30% | Same as 30% | +1× weeklyDCA |

> **VONG (Vanguard Russell 1000 Growth ETF) is treated more aggressively** because it is a diversified index fund — lower individual stock risk.

#### Weekly Dip Buy (Intra-week trigger)

This is an **additional** buy on top of the scheduled weekly amount:

- **Condition:** Current price drops > 3–4% below the price you *just paid* that week.
- **Amount:** 1× weeklyDCA for that stock.
- **Bucket source:** Core bucket (since it's the same size as normal weekly DCA).
- **Active at:** 30%+ dip for all individual stocks; 15%+ dip for VONG.

In practice: if you bought NVDA at $170 on Monday, and by Thursday it is at $163 (−3.95%), you buy an extra $73.87 of NVDA.

#### Notes explicitly written in the sheet

1. *"All are weekly buys"* — every amount in the Buy column is a **weekly recurring** amount, not a one-time buy.
2. *"Weekly dip buy happens if stock price drops more than 3–4% from buying price"* — price-based intra-week trigger.
3. *"S&P500 dropped more than 10% and stayed between 1 to 3 months"* — the Crash bucket is sized assuming a prolonged 1–3 month crash.

---

### Sheet 3 — "Current Positions" (Performance Tracking)

| Metric | Formula |
|---|---|
| **Invested Value** | `units × avgPrice` |
| **Current Value** | `units × currentPrice` |
| **Return ($)** | `currentValue − investedValue` |
| **Return (%)** | `return / investedValue × 100` |
| **Invested Allocation %** | `stockInvestedValue / totalInvested × 100` |
| **Expected Allocation %** | `targetPercent × (totalInvested / totalBudget)` — what your allocation *should* be given current deploy progress |
| **Portfolio Allocation %** | `currentValue / totalCurrentValue × 100` — actual market-value weight |
| **Allocation Progress %** | `investedValue / targetAllocationUSD × 100` — how much of the year's target is filled |

Also tracked: total portfolio return, per-investor contributions (Shashi $14,897, Lucky $8,742).

---

### Sheet 4 — "Transactions" (Ledger)

- Columns per stock: **Date, Amount (price/share), Units, Total**
- Date range in sample data: **Feb 2025 – Jan 2026** (~47 weeks)
- Primarily weekly regular DCA buys (`$74` for NVDA, `$59` for PLTR, etc.)
- Occasional larger buys visible when dip thresholds were crossed (e.g. PLTR at `$177`, SOFI at `$132`, VONG at `$221`)
- GOOGL has a few transactions starting Jan 2026 — strategy is being extended
- No SELL transactions — pure buy-and-hold

---

## 3. Budget as the Central Control Knob

> **This is the most important architectural concept in the whole system.**

The yearly budget is a single number the user sets. Every other number — allocation USD, bucket sizes, weekly DCA, and buy amounts for every dip level — is *derived* from it. Changing the budget once should instantly update everything downstream with no manual recalculation.

### 3.1 The Derivation Chain

```
User sets: totalBudget (e.g. $23,639)
    │
    ▼
allocationUSD  = totalBudget × targetPercent / 100          (per stock)
    │
    ├─► coreBucketUSD   = allocationUSD × coreRatio (0.60)
    │       ├─► monthlyDCA = coreBucketUSD / 12
    │       └─► weeklyDCA  = coreBucketUSD / 48              ← the base unit
    │
    ├─► dipBucketUSD    = allocationUSD × dipRatio  (0.30)
    └─► crashBucketUSD  = allocationUSD × crashRatio (0.10)
    │
    ▼
Strategy buy amounts (auto-computed from weeklyDCA × multiplier):
    10% dip  → 1× weeklyDCA
    15% dip  → 1× weeklyDCA  (3× for aggressive ETFs)
    20% dip  → 3× weeklyDCA  (5× for aggressive ETFs)
    30%+ dip → 5× weeklyDCA
```

### 3.2 Consequence for Strategy Rules

**Strategy rules must store multipliers, not raw amounts.**

The Excel's buy amounts (e.g. NVDA $73.87 at 10%, $221.62 at 20%) are not magic numbers. They are simply:
- `$73.87 = 1× weeklyDCA` where weeklyDCA = coreBucket / 48 at $23,639 budget
- `$221.62 = 3× weeklyDCA`
- `$369.36 = 5× weeklyDCA`

If the budget changes to $30,000, the new amounts automatically become:
- NVDA weeklyDCA = (30,000 × 25% × 60%) / 48 = $93.75
- 10% buy = 1× $93.75 = **$93.75**
- 20% buy = 3× $93.75 = **$281.25**
- 30% buy = 5× $93.75 = **$468.75**

No manual updates required. The user just changes one number.

**Therefore:** `StrategyRule` must store the **multiplier** (an integer: 1, 3, or 5) rather than a raw USD amount or share quantity. The USD buy amount is computed at render time from `weeklyDCA × multiplier`. Shares is then `floor(buyUSD / currentPrice)`.

This also eliminates the need for the `strategyReferenceBudget` scaling hack (`scaledQty = storedQty × currentBudget / referenceBudget`) — that complexity only existed because the current implementation stores quantities.

### 3.3 Budget Change → What Happens

| What changes | What auto-recalculates |
|---|---|
| `totalBudget` | allocationUSD, all bucket USD, weeklyDCA, monthlyDCA, all buy amounts shown on Strategy screen |
| `targetPercent` (for one stock) | That stock's allocationUSD, buckets, DCA, buy amounts |
| `coreRatio / dipRatio / crashRatio` | All bucket USDs, all DCA values, all buy amounts |
| `dcaWeeksPerYear` (48 or 52) | weeklyDCA for all stocks, all buy amounts |

### 3.4 Budget Scenarios (Presets)

A "Budget Preset" is simply a saved `{ name, totalBudget, yearStart, yearEnd }` snapshot. Applying one:
1. Sets `totalBudget` on the portfolio
2. Triggers the full recalculation chain above
3. All bucket used/remaining balances stay as-is (capital already deployed doesn't change)
4. New bucket *sizes* are recalculated from the new budget

Example use cases:
- **Year switching**: "2025 budget was $23,639 → 2026 budget is $28,000"
- **Mid-year budget increase**: "Got a bonus, adding $5,000 to budget" — just change the number
- **Scenario modelling**: "What if I had $40,000?" — preview without committing

### 3.5 Budget Preview (UI requirement)

The Settings / Budget screen must have a live **Budget Preview** widget:
- User types any `totalBudget` value
- Table instantly shows: for each stock → new weeklyDCA, new buy amount per dip level
- User can compare to current amounts before clicking "Apply"
- No page reload required (pure client-side derivation from the formula above)

---

## 4. User Stories

### Core Workflow

| ID | As a user I want to… | So that… |
|---|---|---|
| US-01 | See my portfolio dashboard with current P&L, allocation %, and deployment progress | I have a real-time overview without opening Excel |
| US-02 | View the strategy table (all stocks × all dip levels) with live prices and thresholds | I can immediately see which stocks are at or near a buy threshold |
| US-03 | See a clear "buy signal" for each stock this week with the exact amount and bucket source | I can execute trades without any manual calculation |
| US-04 | Record a transaction (buy/sell/dividend) and have the portfolio update automatically | Shares owned, avg cost basis, and bucket usage stay accurate |
| US-05 | See my current position vs. target allocation per stock with drift highlighting | I know if any stock is significantly over/under weight |
| US-06 | Change the yearly budget to any amount and immediately see how my weekly buy targets change for every stock and dip level | Adjusting my investment pace takes one number, not re-doing the spreadsheet |
| US-06b | Preview what my weekly buys would look like at a different budget before committing | I can plan ahead without breaking the current setup |
| US-07 | Add a new stock to the strategy with its 52w high and dip rules | I can expand my portfolio (e.g. GOOGL) in the app |
| US-08 | See bucket utilisation (Core / Dip / Crash used vs. remaining) per stock | I know how much firepower is left at each dip level |
| US-09 | View full transaction history with filters (by stock, date range, type) | I can audit my trades |
| US-10 | See weekly spending chart (how much deployed per week by stock) | I can visually check my DCA consistency |
| US-11 | Sync live market data on demand (Yahoo Finance) | Strategy thresholds always show current prices |

### Multi-Investor (Advanced)

| ID | Story |
|---|---|
| US-12 | Record each investor's contribution amount so the system knows each person's share of the portfolio |
| US-13 | See each investor's P&L and capital deployed separately |

---

## 5. Functional Requirements

### 4.1 Portfolio & Capital Setup

- **FR-01**: User creates a portfolio with: name, `totalBudget` (USD), optional budget year start/end.
- **FR-02**: Bucket ratios are configurable **per portfolio**: `coreRatio` (default 0.60), `dipRatio` (default 0.30), `crashRatio` (default 0.10). Validation: they must sum to exactly 1.0.
- **FR-03**: User can change `totalBudget` at any time via direct edit **or** by applying a Budget Preset. Both paths trigger the same downstream recalculation.
- **FR-04**: User can save multiple **Budget Presets** `{ name, totalBudget, yearStart, yearEnd }` (e.g. "2025 - $23,639", "2026 - $28,000") and apply one with a single click.
- **FR-05**: Any change to `totalBudget`, `coreRatio`, `dipRatio`, `crashRatio`, or `dcaWeeksPerYear` **immediately and automatically** recalculates everything downstream (see Section 3.3). No manual refresh required.
- **FR-06**: Multi-investor support: record each investor's contributed amount; the app shows per-investor share % and P&L.

### 4.2 Allocation Management

- **FR-07**: User sets a target `%` per stock. Validation: total across active stocks ≤ 100%.
- **FR-08**: The following values are **always computed, never manually entered**:

  ```
  allocationUSD  = totalBudget × targetPercent / 100
  coreBucketUSD  = allocationUSD × coreRatio
  dipBucketUSD   = allocationUSD × dipRatio
  crashBucketUSD = allocationUSD × crashRatio
  monthlyDCA     = coreBucketUSD / 12
  weeklyDCA      = coreBucketUSD / dcaWeeksPerYear   (default 48)
  ```

- **FR-09**: `dcaWeeksPerYear` is a portfolio-level setting (default 48, matching the Excel). User can change to 52 if preferred. Changing it immediately updates all `weeklyDCA` values.
- **FR-10**: Each bucket tracks `usedUSD` (cumulative spend, never auto-reset) and `remainingUSD = bucketUSD − usedUSD`. Bucket *sizes* recalculate when budget changes; `usedUSD` does not reset (already-deployed capital stays spent).

### 4.3 Strategy Rules (The Decision Engine)

Strategy rules define **when** and **how much** to buy. They are **budget-independent** because they store multipliers, not amounts.

- **FR-11**: For each stock, the user defines a `StrategyProfile` with:
  - `fiftyTwoWeekHigh` — the reference high price (manually set; fixed for the strategy period)
  - `isAggressive` — boolean (true for ETFs like VONG; changes multipliers at 15% and 20%)
  - `weeklyDipTriggerPercent` — dip % at which intra-week Weekly Dip trigger activates (default 30%; 15% for aggressive)

- **FR-12**: The five dip levels and their buy multipliers are:

  | Dip Level | Dip Range | Multiplier (normal) | Multiplier (aggressive) | Weekly Dip trigger? |
  |---|---|---|---|---|
  | NORMAL_DCA | < 10% | **1×** | 1× | No |
  | LIGHT_DIP | 10–15% | **1×** | 1× | No |
  | MODERATE_DIP | 15–20% | **1×** | **3×** | Aggressive only |
  | DIP_BUCKET | 20–30% | **3×** | **5×** | No |
  | CRASH_BUCKET | ≥ 30% | **5×** | **5×** | Yes (all stocks) |

- **FR-13**: Buy amounts at any dip level are **always computed as**:
  ```
  buyUSD    = stock.weeklyDCA × multiplier
  buyShares = floor(buyUSD / currentPrice)
  ```
  Because `weeklyDCA` derives from `totalBudget`, buy amounts **automatically scale** when the budget changes. No separate scaling factor or `strategyReferenceBudget` is needed.

- **FR-14**: Threshold price is always computed as:
  ```
  thresholdPrice = fiftyTwoWeekHigh × (1 − dipPercent / 100)
  ```

- **FR-15**: For stocks not yet fully configured (e.g. GOOGL), the system uses default multipliers and the stock's `weeklyDCA`. The user sees computed amounts and can confirm.

### 4.4 Weekly Strategy View (The Main Screen)

- **FR-16**: The strategy view shows one row per stock with:
  - Current price (live from Yahoo) and 52-week high
  - Current dip % from high, current dip level (highlighted)
  - **This week's buy amount (USD) and shares** at each threshold level — computed live from `weeklyDCA × multiplier / currentPrice`
  - Weekly Dip amount where applicable
  - Bucket that would be charged (Core / Dip / Crash) and its remaining balance
- **FR-17**: Stocks currently **at or below a threshold** are highlighted prominently as "buy signals".
- **FR-18**: The header row shows total normal weekly DCA (sum across all stocks at 1× level).
- **FR-19**: User can click "Execute" on a buy signal to record it as a transaction directly from this screen.

### 4.5 Budget Preview (Live What-If)

- **FR-20**: The Strategy and Budget screens include a **Budget Preview** input field where the user can type any hypothetical `totalBudget` value.
- **FR-21**: While previewing, all `weeklyDCA`, buy amounts (USD and shares), and bucket sizes update **instantly** in the UI — client-side only, no API call.
- **FR-22**: Preview is clearly labelled "Preview only — not saved". A "Apply this budget" button saves it.
- **FR-23**: Preview can also be triggered by selecting an existing Budget Preset from a dropdown without committing.

### 4.6 Intra-Week "Weekly Dip Buy" Trigger

- **FR-24**: System tracks the **last executed buy price** per stock per week.
- **FR-25**: If the current price is ≥ 3% below the last executed buy price this week AND the stock's current dip level has a Weekly Dip trigger active, flag it as a "Weekly Dip Opportunity".
- **FR-26**: Weekly Dip buy amount = 1× weeklyDCA. User sees this on the strategy screen and can execute it.

### 4.7 Market Data

- **FR-27**: Sync live data from Yahoo Finance on demand (per portfolio or per symbol).
- **FR-28**: Each sync fetches: current price, 52-week high, 52-week low, daily high/low, volume.
- **FR-29**: System retains **90 days** of price history to support meaningful portfolio value charts.
- **FR-30**: The `fiftyTwoWeekHigh` stored in the strategy profile is the **user's reference point** for threshold calculations. It does NOT auto-update from Yahoo (thresholds are fixed for the strategy period). User can manually update it with a warning that thresholds will shift.

### 4.8 Transactions

- **FR-31**: User records a transaction: symbol, type (BUY/SELL/DIVIDEND/FEE), price, quantity, date, notes.
- **FR-32**: On BUY: `sharesOwned += qty`, `avgCostBasis` recalculated using weighted average, appropriate bucket's `usedUSD += total`, `remainingUSD -= total`, current week's budget `usedAmount += total`.
- **FR-33**: On SELL: `sharesOwned -= qty`. `avgCostBasis` unchanged. Bucket `usedUSD` is **not** restored.
- **FR-34**: **Editing a transaction** must reverse the original allocation impact and reapply the new values.
- **FR-35**: **Deleting a transaction** must fully reverse its allocation impact (shares, cost basis, bucket usage, budget deduction).
- **FR-36**: Bulk CSV import with column mapping.
- **FR-37**: CSV export of full transaction history.
- **FR-38**: Backend paginated transaction API (page size 50, filter by symbol/type/date range).

### 4.9 Analytics & Dashboard

- **FR-39**: Dashboard stat cards: Portfolio value, Total invested, Unrealized P&L (%), Yearly budget, This week's DCA total, Weekly budget used/remaining.
- **FR-40**: Holdings table per stock: shares, avg cost, current price, current value, P&L %, actual allocation %, target %, drift %, allocation progress %, 52w dip %.
- **FR-41**: Allocation pie chart (current market value by stock).
- **FR-42**: Weekly purchases bar chart (stacked by stock, last 12+ weeks).
- **FR-43**: Portfolio value timeseries chart (last 90 days).
- **FR-44**: Bucket utilisation bars per stock: Core / Dip / Crash (allocated vs. used vs. remaining).
- **FR-45**: Dip opportunity list: stocks currently at or below a threshold, sorted by dip %, showing applicable buy amount and bucket remaining.

### 4.10 Budget Management

- **FR-46**: User creates weekly budget records (planned amount, week start date, optional carry-forward from previous week).
- **FR-47**: Weekly budget `usedAmount` auto-decrements when BUY transactions are recorded.
- **FR-48**: Budget summary: current week used/remaining, monthly total, all-time average weekly spend.

---

## 6. Strategy Logic — Precise Specification

### 5.1 Full Computation Chain (runs on any budget change)

```
// Called whenever: totalBudget, coreRatio, dipRatio, crashRatio, dcaWeeksPerYear, or targetPercent changes

for each stock in portfolio.allocations:
  allocationUSD  = totalBudget × stock.targetPercent / 100
  coreBucketUSD  = allocationUSD × portfolio.coreRatio
  dipBucketUSD   = allocationUSD × portfolio.dipRatio
  crashBucketUSD = allocationUSD × portfolio.crashRatio
  monthlyDCA     = coreBucketUSD / 12
  weeklyDCA      = coreBucketUSD / portfolio.dcaWeeksPerYear   // default 48
  // ↑ all buy amounts in the strategy view are derived from weeklyDCA at render time
```

### 5.2 Buy Amount at a Given Dip Level (computed at render/execution time)

```
function getBuyAmount(stock, dipPercent, currentPrice):
  multipliers_normal     = { <10: 1, 10-15: 1, 15-20: 1, 20-30: 3, >=30: 5 }
  multipliers_aggressive = { <10: 1, 10-15: 1, 15-20: 3, 20-30: 5, >=30: 5 }

  multiplier = stock.isAggressive
    ? multipliers_aggressive[dipPercent]
    : multipliers_normal[dipPercent]

  buyUSD    = stock.weeklyDCA × multiplier
  buyShares = floor(buyUSD / currentPrice)

  return { buyUSD, buyShares, multiplier }
```

### 5.3 Bucket Selection

```
function selectBucket(stock, dipPercent):
  dipTrigger = stock.isAggressive ? 15 : 20

  if dipPercent >= 30:
    if stock.crashRemainingUSD > 0: return CRASH
    if stock.dipRemainingUSD   > 0: return DIP      // fallback if crash exhausted
    return null                                       // no budget remaining
  elif dipPercent >= dipTrigger:
    if stock.dipRemainingUSD   > 0: return DIP
    return null
  else:
    if stock.coreRemainingUSD  > 0: return CORE
    return null
```

### 5.4 Weekly Dip Buy Trigger

```
function isWeeklyDipTriggered(stock, currentPrice, lastBuyPriceThisWeek):
  if lastBuyPriceThisWeek is null: return false

  dropFromBuy      = (lastBuyPriceThisWeek - currentPrice) / lastBuyPriceThisWeek
  currentDipLevel  = getDipLevel(stock, currentPrice)
  triggerDipLevel  = stock.isAggressive ? 15 : 30

  return dropFromBuy >= 0.03 AND currentDipPercent >= triggerDipLevel

// Amount if triggered: 1× weeklyDCA (same as weeklyDipUSD in the Excel)
```

### 5.5 Dip Level Classification

| Current price vs 52w High | Dip % | Dip Level |
|---|---|---|
| ≥ 90% of 52wHigh | < 10% | NORMAL_DCA |
| 85–90% | 10–15% | LIGHT_DIP |
| 80–85% | 15–20% | MODERATE_DIP |
| 70–80% | 20–30% | DIP_BUCKET |
| < 70% | > 30% | CRASH_BUCKET |

---

## 7. Data Model Requirements

### New / Modified Fields Needed

| Model | Change |
|---|---|
| `Portfolio` | **Remove** `strategyReferenceBudget` (no longer needed). **Add** `coreRatio`, `dipRatio`, `crashRatio` (float, stored in DB per portfolio, default 0.6/0.3/0.1). **Add** `dcaWeeksPerYear` (int, default 48). |
| `Allocation` | **Add** `isAggressive` (bool, default false) — enables VONG-style multipliers. **Add** `lastWeeklyBuyPrice` (Decimal, nullable) and `lastWeeklyBuyDate` (Date, nullable) — for intra-week trigger tracking. **Remove** `monthlyDCA` and `weeklyDCA` as stored columns — these should be computed on the fly from `coreBucketUSD / 12` and `coreBucketUSD / dcaWeeksPerYear`. Or keep them as cached computed fields that are always overwritten on recalculate. |
| `StrategyRule` | **Replace** `buyQuantity` and `weeklyDipQuantity` (stored share counts) with `buyMultiplier` (int: 1, 3, or 5) and `weeklyDipMultiplier` (int: 0 or 1, nullable). **Remove** `fiftyTwoWeekHigh` from this model — it belongs on `Allocation` or a new `StockProfile`. **Add** `fiftyTwoWeekHighUpdatedAt` to track staleness. |
| `Transaction` | No schema change. But **all side effects** (allocation updates) must be reversible on edit/delete — implement as a service-layer transaction reversal pattern. |
| `Investor` (NEW) | `id`, `portfolioId`, `name`, `contributionAmount` — tracks per-person capital in shared portfolios. |
| `PriceDaily` | Extend retention logic to 90 days. |

---

## 8. Implementation Gaps vs. Current Codebase

| # | Gap | Impact | Fix |
|---|---|---|---|
| G-01 | **[Budget scaling]** `StrategyRule` stores raw `buyQuantity` (shares) and uses `strategyReferenceBudget` scaling. Changing budget requires a scale factor calculation. | Fragile; rounding errors; breaks when reference budget is wrong | Replace with multiplier-based rules (FR-12, FR-13). `buyUSD = weeklyDCA × multiplier` is always fresh. Remove `strategyReferenceBudget`. |
| G-02 | **[Budget scaling]** Changing `totalCapital` (budget) does NOT auto-recalculate allocation buckets or DCA. User must manually trigger recalculate. | Buy amounts shown are stale until manual refresh | Call `recalculateBuckets()` automatically inside `portfolio.update()` and `applyBudgetPreset()` |
| G-03 | **[Budget scaling]** No live Budget Preview — user cannot see what weekly buys would look like at a different budget before committing | Poor UX; hard to plan budget changes | Implement client-side preview widget (FR-20 to FR-23) |
| G-04 | **[Budget scaling]** `dcaWeeksPerYear` is hardcoded to 48 everywhere. Not surfaced as a setting. | Cannot adjust for users who prefer 52-week DCA | Add `dcaWeeksPerYear` to Portfolio model; default 48 |
| G-05 | Bucket ratios are 0.6/0.2/0.04 in `.env` but actual Excel data shows 0.6/0.3/0.1 (sums to 1.0) | Every allocation USD amount is wrong | Move ratios to DB per-portfolio; correct defaults to 0.6/0.3/0.1 |
| G-06 | Transaction delete/edit doesn't reverse allocation state | `sharesOwned` and bucket usage drift from reality over time | Implement reversal logic in `TransactionService.update()` and `remove()` |
| G-07 | `executeBuyPlan` increments `*UsedUSD` but never decrements `*RemainingUSD` | Remaining balance stale until manual recalculate | Fix in `StrategyService.executeBuyPlan()` |
| G-08 | Dynamic `generateStrategy()` ignores multiplier rules; does equal-split of budget instead | The strategy engine doesn't respect the Excel logic | Rewrite to use `weeklyDCA × multiplier` per FR-13 |
| G-09 | Intra-week "Weekly Dip Buy" trigger is not implemented | A key buy signal from the Excel is missing | Implement FR-24 to FR-26 |
| G-10 | VONG-style "aggressive mode" (3× at 15%, weekly dip at 15%) is not modelled | VONG is treated the same as individual stocks | Add `isAggressive` flag to Allocation (FR-11) |
| G-11 | Price history retention = 14 days | Portfolio value chart has only 2 weeks of data | Extend to 90 days (FR-29) |
| G-12 | `StrategyRule.fiftyTwoWeekHigh` is a static snapshot from seed date | Thresholds silently drift as time passes | Surface `lastUpdated` on the strategy screen; show a staleness warning |
| G-13 | Multi-investor support (Shashi/Lucky split) is not modelled | Cannot show per-person P&L | Add `Investor` model |
| G-14 | No transaction pagination on backend | Slow load for large portfolios | Add `skip/take` to `TransactionService.findAll()` |
| G-15 | No CSV export | Cannot take data out | Add export endpoint (FR-37) |
| G-16 | JWT auth bypass is global | Completely insecure for multi-user | Remove bypass; enforce `JwtAuthGuard` globally |
| G-17 | GOOGL and future stocks can't be added via UI | Strategy expansion requires DB entry | Build "Add stock to strategy" UI flow |
| G-18 | `getPerformanceAnalytics` always returns a single data point | Performance chart is meaningless | Compute daily values from price history × shares |

---

## 9. UI / Screen Map

| Screen | Primary Purpose |
|---|---|
| **Dashboard** | Portfolio snapshot: value, P&L, allocation pie, weekly spend chart, dip alerts |
| **Strategy** ← _Main screen_ | Strategy table (stock × dip level), live prices, active buy signals, execute buttons, weekly dip trigger alerts |
| **Allocation** | Manage stock target %, bucket breakdown table, allocation progress per stock |
| **Transactions** | Ledger: add/edit/delete/import/export transactions |
| **Budget** | Yearly presets, weekly budget records, utilisation summary |
| **Analytics** | Full analytics: bucket utilisation, allocation drift, timeseries chart, dip opportunities list |
| **Settings** | Portfolio settings, bucket ratios, DCAs-per-year, investor contributions |

---

## 10. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Strategy table (with live sync) loads in < 5 seconds for up to 20 stocks |
| **Data accuracy** | All monetary calculations use Decimal with ≥ 2dp precision; no floating-point drift |
| **Reliability** | Market data sync failures are graceful (show last known data with timestamp) |
| **Offline-first** | If Yahoo Finance is unreachable, the app still loads with cached prices and shows a warning |
| **Audit trail** | Every state change (transaction, budget update, preset apply) is timestamped |
| **Export** | Transaction CSV export always available |

---

## 11. Out of Scope (V1)

- Automated trade execution via broker API
- Mobile app (responsive web is sufficient)
- Multi-currency support
- Options / derivatives tracking
- Tax lot accounting
- Real-time WebSocket price streaming (polling on demand is fine)
