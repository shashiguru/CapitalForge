'use client';

import { useEffect, useState } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { analyticsApi, portfolioApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import type { AllocationRebalance, AllocationRebalanceRow, BudgetPreset } from '@/lib/types';
import { cn } from '@/lib/utils';

type View = 'year' | 'alltime';

function usd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function usd2(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function ProgressBadge({ value }: { value: number }) {
  const color =
    value >= 75 ? 'bg-emerald-100 text-emerald-700'
    : value >= 50 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';
  const bar = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="w-20 h-2 bg-border rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded tabular-nums min-w-[36px] text-center', color)}>
        {Math.round(value)}
      </span>
    </div>
  );
}

function ActionBadge({ action }: { action: AllocationRebalanceRow['action'] }) {
  const styles = {
    BUY: 'bg-blue-100 text-blue-700 border border-blue-200',
    ON_TRACK: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    OVERWEIGHT: 'bg-orange-100 text-orange-700 border border-orange-200',
  };
  const labels = { BUY: 'BUY MORE', ON_TRACK: 'ON TRACK', OVERWEIGHT: 'OVERWEIGHT' };
  return (
    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider', styles[action])}>
      {labels[action]}
    </span>
  );
}

function getAllTimeAction(
  delta: number,
  targetUSD: number,
): AllocationRebalanceRow['action'] {
  if (delta > targetUSD * 0.05) return 'BUY';
  if (delta < -targetUSD * 0.05) return 'OVERWEIGHT';
  return 'ON_TRACK';
}

export default function AllocationPage() {
  const { selectedPortfolio } = usePortfolio();
  const [data, setData] = useState<AllocationRebalance | null>(null);
  const [budgetPresets, setBudgetPresets] = useState<BudgetPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<View>('year');

  useEffect(() => {
    if (!selectedPortfolio) return;
    setIsLoading(true);
    Promise.all([
      analyticsApi.getAllocationRebalance(selectedPortfolio.id),
      portfolioApi.getBudgetPresets(selectedPortfolio.id).catch(() => []),
    ])
      .then(([rebalance, presets]) => {
        setData(rebalance);
        setBudgetPresets(presets);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [selectedPortfolio]);

  if (!selectedPortfolio) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="label-caps text-muted-foreground">No portfolio selected</p>
        </div>
      </AppShell>
    );
  }

  const rows = data?.rows ?? [];
  const yearTargetUSD = data?.totalTargetUSD ?? selectedPortfolio.totalCapital ?? 0;
  const sortedBudgetPresets = [...budgetPresets].sort((a, b) =>
    (a.budgetYearStart ?? a.name).localeCompare(b.budgetYearStart ?? b.name),
  );
  const lifetimeBudgetTotal =
    sortedBudgetPresets.length > 0
      ? sortedBudgetPresets.reduce((s, p) => s + p.totalCapital, 0)
      : yearTargetUSD;
  const totalTarget = view === 'alltime' ? lifetimeBudgetTotal : yearTargetUSD;
  const totalInvested = data?.totalInvested ?? 0;
  const totalYtd = data?.totalYtdInvested ?? 0;
  const totalCurrentValue = data?.totalCurrentValue ?? 0;
  const overallProgress =
    lifetimeBudgetTotal > 0 ? (totalInvested / lifetimeBudgetTotal) * 100 : 0;
  const ytdProgress = yearTargetUSD > 0 ? (totalYtd / yearTargetUSD) * 100 : 0;

  const lifetimeTargetUSD = (row: AllocationRebalanceRow) =>
    (row.targetPercent / 100) * lifetimeBudgetTotal;
  const allTimeProgress = (row: AllocationRebalanceRow) => {
    const target = lifetimeTargetUSD(row);
    return target > 0 ? (row.totalInvested / target) * 100 : 0;
  };
  const allTimeDelta = (row: AllocationRebalanceRow) =>
    lifetimeTargetUSD(row) - row.totalInvested;

  const buyRows = rows.filter((row) => {
    if (view === 'year') return row.action === 'BUY';
    return getAllTimeAction(allTimeDelta(row), lifetimeTargetUSD(row)) === 'BUY';
  });
  const totalBuyNeeded = buyRows.reduce((s, row) => {
    const delta = view === 'year' ? row.rebalanceDelta : allTimeDelta(row);
    return s + Math.max(delta, 0);
  }, 0);
  const yearLabel = data ? `${new Date(data.yearStart).getFullYear()} Fiscal Year` : 'Current Year';

  return (
    <AppShell>
      <PageHeader
        eyebrow="Allocation · Rebalancing"
        title="Allocation Tracker"
        titleSize="large"
        subtitle={`${selectedPortfolio.name} · Track progress toward targets & identify rebalancing needs`}
        actions={
          sortedBudgetPresets.length > 0 ? (
            <div className="hidden md:flex items-center gap-6 pt-2">
              {sortedBudgetPresets.map((preset) => (
                <div key={preset.id} className="text-right">
                  <p className="label-caps">{preset.name}</p>
                  <p className="text-lg font-semibold tabular-nums">{usd(preset.totalCapital)}</p>
                </div>
              ))}
            </div>
          ) : undefined
        }
      />

      {sortedBudgetPresets.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4 md:hidden">
          {sortedBudgetPresets.map((preset) => (
            <div key={preset.id} className="bg-card border border-border rounded-sm p-3">
              <p className="label-caps mb-1 text-[10px]">{preset.name}</p>
              <p className="text-xl font-serif tabular-nums">{usd(preset.totalCapital)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="label-caps mb-2">{view === 'alltime' ? 'Total Budget' : 'Year Target'}</p>
          {isLoading ? <Skeleton className="h-8 w-24" /> : (
            <>
              <p className="text-2xl font-serif tabular-nums">{usd(totalTarget)}</p>
              {view === 'alltime' && sortedBudgetPresets.length > 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {sortedBudgetPresets.map((p) => usd(p.totalCapital)).join(' + ')}
                </p>
              )}
            </>
          )}
        </div>
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="label-caps mb-2">All-Time Invested</p>
          {isLoading ? <Skeleton className="h-8 w-24" /> : (
            <>
              <p className="text-2xl font-serif tabular-nums">{usd(totalInvested)}</p>
              <div className="mt-2 h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-foreground rounded-full" style={{ width: `${Math.min(overallProgress, 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {overallProgress.toFixed(1)}% of total budget ({usd(lifetimeBudgetTotal)})
              </p>
            </>
          )}
        </div>
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="label-caps mb-2">YTD Invested</p>
          {isLoading ? <Skeleton className="h-8 w-24" /> : (
            <>
              <p className="text-2xl font-serif tabular-nums">{usd(totalYtd)}</p>
              <div className="mt-2 h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(ytdProgress, 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {ytdProgress.toFixed(1)}% of {yearLabel.toLowerCase()} ({usd(yearTargetUSD)})
              </p>
            </>
          )}
        </div>
        <div className={cn('border rounded-sm p-4', totalBuyNeeded > 0 ? 'bg-blue-50 border-blue-200' : 'bg-card border-border')}>
          <p className="label-caps mb-2">Still to Deploy</p>
          {isLoading ? <Skeleton className="h-8 w-24" /> : (
            <>
              <p className={cn('text-2xl font-serif tabular-nums', totalBuyNeeded > 0 ? 'text-blue-700' : 'text-emerald-700')}>
                {usd(Math.max(totalBuyNeeded, 0))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {buyRows.length} position{buyRows.length !== 1 ? 's' : ''} below target
              </p>
            </>
          )}
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 border-b border-border mb-0">
        {([
          { key: 'year' as View, label: yearLabel },
          { key: 'alltime' as View, label: 'All Time' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={cn(
              'px-4 py-2.5 text-xs font-semibold tracking-wider uppercase transition-colors border-b-2 -mb-px',
              view === tab.key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Rebalance table */}
      <div className="bg-card border border-border rounded-sm mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-3 px-5 label-caps text-left">Symbol</th>
                <th className="py-3 px-5 label-caps text-right">Target%</th>
                <th className="py-3 px-5 label-caps text-right">Target USD</th>
                <th className="py-3 px-5 label-caps text-right">
                  {view === 'year' ? 'YTD Invested' : 'Total Invested'}
                </th>
                <th className="py-3 px-5 label-caps text-right">Current Value</th>
                <th className="py-3 px-5 label-caps text-right">Portfolio%</th>
                <th className="py-3 px-5 label-caps text-right">Drift</th>
                <th className="py-3 px-5 label-caps text-right">Progress</th>
                <th className="py-3 px-5 label-caps text-right">
                  {view === 'year' ? 'YTD Gap' : 'Rebalance'}
                </th>
                <th className="py-3 px-5 label-caps text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="border-b border-border">
                      <td colSpan={10} className="px-5 py-3"><Skeleton className="h-4 w-full" /></td>
                    </tr>
                  ))
                : rows.length === 0
                ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-10 text-center text-muted-foreground text-sm">
                        No data — add stocks in <strong>Budget</strong> and sync market prices.
                      </td>
                    </tr>
                  )
                : rows.map((row) => {
                    const rowTargetUSD =
                      view === 'year' ? row.targetAllocationUSD : lifetimeTargetUSD(row);
                    const invested = view === 'year' ? row.ytdInvested : row.totalInvested;
                    const progress =
                      view === 'year' ? row.ytdProgress : allTimeProgress(row);
                    const delta = view === 'year' ? row.ytdRebalanceDelta : allTimeDelta(row);
                    const action =
                      view === 'year'
                        ? row.action
                        : getAllTimeAction(delta, rowTargetUSD);
                    const drift = row.driftPercent;
                    return (
                      <tr key={row.symbol} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="py-3.5 px-5">
                          <div>
                            <p className="font-semibold">{row.symbol}</p>
                            {row.companyName && <p className="text-[11px] text-muted-foreground leading-tight">{row.companyName}</p>}
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right tabular-nums font-medium">{row.targetPercent.toFixed(0)}%</td>
                        <td className="py-3.5 px-5 text-right tabular-nums text-muted-foreground">{usd(rowTargetUSD)}</td>
                        <td className="py-3.5 px-5 text-right tabular-nums font-semibold">
                          {usd(invested)}
                          {view === 'year' && row.ytdTransactionCount > 0 && (
                            <p className="text-[10px] text-muted-foreground font-normal">{row.ytdTransactionCount} tx</p>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right tabular-nums">
                          <span className="font-semibold">{usd(row.currentValue)}</span>
                          <p className={cn('text-[11px]', row.unrealizedPnL >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                            {row.unrealizedPnL >= 0 ? '+' : ''}{pct(row.unrealizedPnLPercent)}
                          </p>
                        </td>
                        <td className="py-3.5 px-5 text-right tabular-nums text-muted-foreground">{row.allocationPercent.toFixed(2)}%</td>
                        <td className={cn('py-3.5 px-5 text-right tabular-nums font-medium', Math.abs(drift) > 5 ? (drift > 0 ? 'text-emerald-600' : 'text-red-600') : 'text-muted-foreground')}>
                          {drift >= 0 ? '+' : ''}{drift.toFixed(1)}%
                        </td>
                        <td className="py-3.5 px-5 text-right"><ProgressBadge value={progress} /></td>
                        <td className={cn('py-3.5 px-5 text-right tabular-nums font-semibold', delta > 0 ? 'text-blue-700' : delta < -500 ? 'text-orange-600' : 'text-muted-foreground')}>
                          {delta > 0 ? `+${usd(delta)}` : usd(delta)}
                          {delta > 0 && row.currentPrice > 0 && (
                            <p className="text-[10px] text-muted-foreground font-normal">
                              ~{Math.floor(delta / row.currentPrice)} sh @ {usd2(row.currentPrice)}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right"><ActionBadge action={action} /></td>
                      </tr>
                    );
                  })}

              {/* Totals */}
              {!isLoading && rows.length > 0 && (() => {
                const totalInv = view === 'year'
                  ? rows.reduce((s, r) => s + r.ytdInvested, 0)
                  : rows.reduce((s, r) => s + r.totalInvested, 0);
                const avgProg = view === 'year'
                  ? rows.reduce((s, r) => s + r.ytdProgress, 0) / rows.length
                  : rows.reduce((s, r) => s + allTimeProgress(r), 0) / rows.length;
                const totalDelta = view === 'year'
                  ? rows.reduce((s, r) => s + r.ytdRebalanceDelta, 0)
                  : rows.reduce((s, r) => s + allTimeDelta(r), 0);
                return (
                  <tr className="bg-muted/30 border-t-2 border-border font-semibold">
                    <td className="py-3 px-5 text-xs uppercase tracking-wider text-muted-foreground">Total</td>
                    <td className="py-3 px-5 text-right tabular-nums">{rows.reduce((s, r) => s + r.targetPercent, 0).toFixed(0)}%</td>
                    <td className="py-3 px-5 text-right tabular-nums">{usd(totalTarget)}</td>
                    <td className="py-3 px-5 text-right tabular-nums">{usd(totalInv)}</td>
                    <td className="py-3 px-5 text-right tabular-nums">{usd(totalCurrentValue)}</td>
                    <td className="py-3 px-5 text-right tabular-nums">{rows.reduce((s, r) => s + r.allocationPercent, 0).toFixed(1)}%</td>
                    <td className="py-3 px-5" />
                    <td className="py-3 px-5 text-right"><ProgressBadge value={avgProg} /></td>
                    <td className={cn('py-3 px-5 text-right tabular-nums', totalDelta > 0 ? 'text-blue-700' : 'text-muted-foreground')}>
                      {totalDelta > 0 ? `+${usd(totalDelta)}` : usd(totalDelta)}
                    </td>
                    <td className="py-3 px-5" />
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rebalancing callout */}
      {!isLoading && buyRows.length > 0 && (
        <div className="border border-blue-200 bg-blue-50 rounded-sm p-5">
          <p className="label-caps text-blue-600 mb-3">Rebalancing Suggestions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {buyRows.map((row) => {
              const delta = view === 'alltime' ? allTimeDelta(row) : row.rebalanceDelta;
              const progress = view === 'alltime' ? allTimeProgress(row) : row.allocationProgress;
              return (
              <div key={row.symbol} className="bg-white border border-blue-100 rounded-sm p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{row.symbol}</span>
                  <span className="text-xs text-blue-600 font-bold">{usd(Math.max(delta, 0))}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {progress.toFixed(0)}% of target filled ·{' '}
                  {row.sharesToBuy > 0 ? `~${row.sharesToBuy} sh to buy` : 'top up needed'}
                </p>
                <div className="mt-1.5 h-1 bg-blue-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
              </div>
            );})}
          </div>
        </div>
      )}
    </AppShell>
  );
}
