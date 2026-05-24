'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { strategyApi, portfolioApi, marketDataApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw } from 'lucide-react';
import type { PortfolioStrategyTable, DipLevelThreshold } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/** Pure client-side formula */
function computeWeeklyDCA(budget: number, targetPct: number, coreRatio: number, dcaWeeks: number) {
  return (budget * targetPct / 100 * coreRatio) / dcaWeeks;
}

const DIP_COLUMNS = [
  { key: 'NORMAL', label: 'NORMAL', sub: '< 10%', minDip: -1, maxDip: 10 },
  { key: 'LIGHT',  label: 'LIGHT DIP', sub: '10–15%', minDip: 10, maxDip: 15 },
  { key: 'MOD',    label: 'MODERATE', sub: '15–20%', minDip: 15, maxDip: 20 },
  { key: 'DIP',    label: 'DIP', sub: '20–30%', minDip: 20, maxDip: 30 },
  { key: 'CRASH',  label: 'CRASH', sub: '≥ 30%', minDip: 30, maxDip: 999 },
];

function usd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function StrategyPage() {
  const { selectedPortfolio, fetchPortfolios, refreshPortfolio, updatePortfolio } = usePortfolio();
  const [strategyTable, setStrategyTable] = useState<PortfolioStrategyTable | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Budget modal
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [yearStartInput, setYearStartInput] = useState('');
  const [yearEndInput, setYearEndInput] = useState('');
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  const fetchData = useCallback(async () => {
    if (!selectedPortfolio) return;
    setIsLoading(true);
    try {
      const tableData = await strategyApi.getStrategyTable(selectedPortfolio.id).catch(() => null);
      setStrategyTable(tableData);
    } catch {
      toast.error('Failed to load strategy data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPortfolio?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (selectedPortfolio) {
      setBudgetInput(selectedPortfolio.totalCapital.toString());
      const y = new Date().getFullYear();
      setYearStartInput(selectedPortfolio.budgetYearStart ?? `${y}-01-01`);
      setYearEndInput(selectedPortfolio.budgetYearEnd ?? `${y}-12-31`);
    }
  }, [selectedPortfolio]);

  const handleSync = async () => {
    if (!selectedPortfolio) return;
    setIsSyncing(true);
    try {
      await marketDataApi.sync([], selectedPortfolio.id);
      await fetchData();
      toast.success('Prices refreshed');
    } catch {
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveBudget = async () => {
    if (!selectedPortfolio) return;
    const totalCapital = parseFloat(budgetInput);
    if (isNaN(totalCapital) || totalCapital <= 0) { toast.error('Invalid amount'); return; }
    setIsSavingBudget(true);
    try {
      await portfolioApi.update(selectedPortfolio.id, {
        totalCapital,
        budgetYearStart: yearStartInput || undefined,
        budgetYearEnd: yearEndInput || undefined,
      });
      await fetchPortfolios();
      await refreshPortfolio();
      await fetchData();
      toast.success('Budget updated');
      setIsBudgetModalOpen(false);
    } catch { toast.error('Failed to save'); }
    finally { setIsSavingBudget(false); }
  };

  if (!selectedPortfolio) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="label-caps mb-2">No portfolio selected</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const stocks = strategyTable?.stocks ?? [];
  const coreR = selectedPortfolio.coreRatio ?? 0.60;
  const dipR = selectedPortfolio.dipRatio ?? 0.30;
  const crashR = selectedPortfolio.crashRatio ?? 0.10;
  const dcaW = selectedPortfolio.dcaWeeksPerYear ?? 48;
  const totalBudget = selectedPortfolio.totalCapital;

  return (
    <AppShell>
      <PageHeader
        title="Weekly Strategy"
        subtitle="Buy amounts derived from weeklyDCA × multiplier. Multipliers stored, never raw USD."
        actions={
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleSync}
            disabled={isSyncing || isLoading}
            aria-label="Sync Yahoo Finance"
            title="Sync Yahoo Finance"
            className="md:size-auto md:h-8 md:px-3"
          >
            {isSyncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="hidden md:inline">Sync Yahoo Finance</span>
          </Button>
        }
      />

      {/* ─── Strategy Table ─── */}
      <div className="bg-card border border-border rounded-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 label-caps w-[160px]">Stock</th>
                <th className="text-right py-3 px-4 label-caps">Price / 52W High</th>
                <th className="text-right py-3 px-4 label-caps">Dip%</th>
                <th className="text-right py-3 px-4 label-caps">Weekly DCA</th>
                {DIP_COLUMNS.map((col) => (
                  <th key={col.key} className="text-center py-3 px-3 label-caps">
                    {col.label}
                    <div className="font-normal normal-case tracking-normal text-[10px] text-muted-foreground/70">
                      {col.sub}
                    </div>
                  </th>
                ))}
                <th className="text-center py-3 px-4 label-caps">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [1, 2, 3, 4, 5, 6].map((i) => (
                    <tr key={i} className="border-b border-border">
                      <td colSpan={10} className="px-4 py-3">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : stocks.map((stock) => {
                    const activeDip = stock.currentDipPercent;

                    // Map levels by their dipPercent thresholds
                    const levelByDip = (minDip: number, maxDip: number): DipLevelThreshold | undefined =>
                      stock.levels.find((l) =>
                        minDip === -1
                          ? l.dipPercent === 0
                          : l.dipPercent >= minDip && l.dipPercent < maxDip
                      );

                    const isColumnActive = (minDip: number, maxDip: number): boolean => {
                      if (minDip === -1) return activeDip < 10;
                      return activeDip >= minDip && activeDip < maxDip;
                    };

                    const renderCell = (col: (typeof DIP_COLUMNS)[0]) => {
                      const level = levelByDip(col.minDip, col.maxDip);
                      const active = isColumnActive(col.minDip, col.maxDip);
                      const buyUSD = level ? level.buyUSD : stock.weeklyDCA;
                      const multiplier = level ? level.multiplier : 1;
                      const shares = stock.currentPrice > 0 ? Math.floor(buyUSD / stock.currentPrice) : 0;

                      return (
                        <td
                          key={col.key}
                          className={cn(
                            'text-center py-3 px-3 transition-colors',
                            active && 'bg-foreground text-background',
                            !active && col.key === 'CRASH' && 'bg-red-50/60',
                            !active && col.key === 'DIP' && 'bg-amber-50/40',
                          )}
                        >
                          <div className={cn('font-semibold tabular-nums', active && 'text-background')}>
                            {usd(buyUSD)}
                          </div>
                          <div className={cn('text-[10px] mt-0.5', active ? 'text-background/70' : 'text-muted-foreground')}>
                            {shares} sh · {multiplier}×
                          </div>
                        </td>
                      );
                    };

                    const hasActiveSignal = stocks.some(
                      (s) => s.symbol === stock.symbol && s.levels.some((l) => l.isActive)
                    ) || activeDip < 10;
                    const isWeeklyDip = stock.isWeeklyDipTriggered;

                    return (
                      <tr
                        key={stock.symbol}
                        className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        {/* Stock */}
                        <td className="py-3 px-4">
                          <p className="font-semibold">{stock.symbol}</p>
                          {stock.companyName && (
                            <p className="text-[11px] text-muted-foreground">{stock.companyName}</p>
                          )}
                        </td>

                        {/* Price / 52W High */}
                        <td className="py-3 px-4 text-right">
                          <p className="font-semibold tabular-nums">${stock.currentPrice.toFixed(2)}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            / ${(stock.storedFiftyTwoWeekHigh ?? stock.liveFiftyTwoWeekHigh).toFixed(2)}
                          </p>
                        </td>

                        {/* Dip% */}
                        <td className="py-3 px-4 text-right">
                          <span
                            className={cn(
                              'font-semibold tabular-nums',
                              activeDip >= 30 ? 'text-red-600' :
                              activeDip >= 20 ? 'text-orange-600' :
                              activeDip >= 10 ? 'text-amber-600' : 'text-muted-foreground'
                            )}
                          >
                            {activeDip > 0 ? `−${activeDip.toFixed(1)}%` : '—'}
                          </span>
                        </td>

                        {/* Weekly DCA */}
                        <td className="py-3 px-4 text-right tabular-nums font-medium">
                          {usd(stock.weeklyDCA)}
                        </td>

                        {/* Dip level columns */}
                        {DIP_COLUMNS.map((col) => renderCell(col))}

                        {/* Action */}
                        <td className="py-3 px-4 text-center">
                          {hasActiveSignal ? (
                            <button className="bg-foreground text-background text-xs font-semibold px-3 py-1.5 rounded-sm hover:bg-foreground/90 transition-colors flex items-center gap-1 mx-auto">
                              ⚡ Execute
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Log DCA</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Bucket usage cards ─── */}
      {stocks.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {stocks.map((stock) => {
            const alloc = totalBudget * 0.25; // approximate
            const coreBucket = stock.coreRemainingUSD;
            const dipBucket = stock.dipRemainingUSD;
            const crashBucket = stock.crashRemainingUSD;
            const targetAlloc = stock.targetAllocationUSD;

            const coreFull = targetAlloc * coreR;
            const dipFull = targetAlloc * dipR;
            const crashFull = targetAlloc * crashR;

            return (
              <div key={stock.symbol} className="bg-card border border-border rounded-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-sm">{stock.symbol}</p>
                  <span className="label-caps">{usd(targetAlloc)} alloc</span>
                </div>

                {[
                  { name: 'Core', remaining: coreBucket, total: coreFull, color: 'bg-blue-500' },
                  { name: 'Dip', remaining: dipBucket, total: dipFull, color: 'bg-amber-500' },
                  { name: 'Crash', remaining: crashBucket, total: crashFull, color: 'bg-red-500' },
                ].map((b) => (
                  <div key={b.name} className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{b.name}</span>
                      <span className="tabular-nums text-foreground/80">
                        {usd(Math.max(0, b.total - b.remaining))} / {usd(b.total)}
                      </span>
                    </div>
                    <div className="h-1 bg-border rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', b.color)}
                        style={{
                          width: `${b.total > 0 ? Math.min(((b.total - b.remaining) / b.total) * 100, 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Footer info bar ─── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-t border-border pt-4">
        <span>
          Total budget: <strong className="text-foreground">{usd(totalBudget)}</strong>
        </span>
        <span>·</span>
        <span>
          Buckets:{' '}
          <strong className="text-foreground">
            {Math.round(coreR * 100)}% Core / {Math.round(dipR * 100)}% Dip / {Math.round(crashR * 100)}% Crash
          </strong>
        </span>
        <span>·</span>
        <span>
          DCA cadence: <strong className="text-foreground">{dcaW} weeks/yr</strong>
        </span>
        <button
          onClick={() => setIsBudgetModalOpen(true)}
          className="ml-auto text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground"
        >
          Edit budget
        </button>
      </div>

      {/* ─── Update Budget Modal ─── */}
      <Dialog open={isBudgetModalOpen} onOpenChange={setIsBudgetModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Budget</DialogTitle>
            <DialogDescription>
              Change your yearly budget. All allocations and DCA amounts recalculate instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Budget ($)</Label>
              <Input
                type="number"
                min={0}
                step={1000}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="23639"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input type="date" value={yearStartInput} onChange={(e) => setYearStartInput(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input type="date" value={yearEndInput} onChange={(e) => setYearEndInput(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBudgetModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBudget} disabled={isSavingBudget}>
              {isSavingBudget && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
