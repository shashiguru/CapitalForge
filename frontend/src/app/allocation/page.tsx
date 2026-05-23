'use client';

import { useEffect, useState } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { analyticsApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { Skeleton } from '@/components/ui/skeleton';
import type { AllocationRebalance, AllocationRebalanceRow } from '@/lib/types';
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

export default function AllocationPage() {
  const { selectedPortfolio } = usePortfolio();
  const [data, setData] = useState<AllocationRebalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<View>('year');

  useEffect(() => {
    if (!selectedPortfolio) return;
    setIsLoading(true);
    analyticsApi
      .getAllocationRebalance(selectedPortfolio.id)
      .then((d) => setData(d))
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
  const totalTarget = data?.totalTargetUSD ?? 0;
  const totalInvested = data?.totalInvested ?? 0;
  const totalYtd = data?.totalYtdInvested ?? 0;
  const totalCurrentValue = data?.totalCurrentValue ?? 0;
  const overallProgress = totalTarget > 0 ? (totalInvested / totalTarget) * 100 : 0;
  const ytdProgress = totalTarget > 0 ? (totalYtd / totalTarget) * 100 : 0;
  const buyRows = rows.filter((r) => r.action === 'BUY');
  const totalBuyNeeded = buyRows.reduce((s, r) => s + r.rebalanceDelta, 0);
  const yearLabel = data ? `${new Date(data.yearStart).getFullYear()} Fiscal Year` : 'Current Year';

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-8">
        <p className="label-caps mb-1">Allocation · Rebalancing</p>
        <h1 className="text-5xl font-serif font-normal text-foreground leading-tight">
          Allocation Tracker
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {selectedPortfolio.name} · Track progress toward targets &amp; identify rebalancing needs
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="label-caps mb-2">Total Target</p>
          {isLoading ? <Skeleton className="h-8 w-24" /> : (
            <p className="text-2xl font-serif tabular-nums">{usd(totalTarget)}</p>
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
              <p className="text-xs text-muted-foreground mt-1">{overallProgress.toFixed(1)}% of target</p>
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
              <p className="text-xs text-muted-foreground mt-1">{ytdProgress.toFixed(1)}% of target</p>
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
                    const invested = view === 'year' ? row.ytdInvested : row.totalInvested;
                    const progress = view === 'year' ? row.ytdProgress : row.allocationProgress;
                    const delta = view === 'year' ? row.ytdRebalanceDelta : row.rebalanceDelta;
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
                        <td className="py-3.5 px-5 text-right tabular-nums text-muted-foreground">{usd(row.targetAllocationUSD)}</td>
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
                        <td className="py-3.5 px-5 text-right"><ActionBadge action={row.action} /></td>
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
                  : rows.reduce((s, r) => s + r.allocationProgress, 0) / rows.length;
                const totalDelta = view === 'year'
                  ? rows.reduce((s, r) => s + r.ytdRebalanceDelta, 0)
                  : rows.reduce((s, r) => s + r.rebalanceDelta, 0);
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
            {buyRows.map((row) => (
              <div key={row.symbol} className="bg-white border border-blue-100 rounded-sm p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{row.symbol}</span>
                  <span className="text-xs text-blue-600 font-bold">{usd(row.rebalanceDelta)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {row.allocationProgress.toFixed(0)}% of target filled ·{' '}
                  {row.sharesToBuy > 0 ? `~${row.sharesToBuy} sh to buy` : 'top up needed'}
                </p>
                <div className="mt-1.5 h-1 bg-blue-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(row.allocationProgress, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
