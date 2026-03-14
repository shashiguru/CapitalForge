'use client';

import { useEffect, useState } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { strategyApi, budgetApi, marketDataApi, allocationApi, portfolioApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Calendar, Pencil, Plus } from 'lucide-react';
import type { WeeklyBudget, StoredStrategyRules, MarketDataSummary, Allocation, BudgetPreset } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function getDefaultYearDates() {
  const y = new Date().getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

export default function StrategyPage() {
  const { selectedPortfolio, fetchPortfolios, refreshPortfolio, updatePortfolio } = usePortfolio();
  const [currentBudget, setCurrentBudget] = useState<WeeklyBudget | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [strategyRefInput, setStrategyRefInput] = useState('');
  const [yearStartInput, setYearStartInput] = useState('');
  const [yearEndInput, setYearEndInput] = useState('');
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isAddBudgetModalOpen, setIsAddBudgetModalOpen] = useState(false);
  const [addBudgetName, setAddBudgetName] = useState('');
  const [addBudgetAmount, setAddBudgetAmount] = useState('');
  const [addBudgetStart, setAddBudgetStart] = useState('');
  const [addBudgetEnd, setAddBudgetEnd] = useState('');
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [budgetPresets, setBudgetPresets] = useState<BudgetPreset[]>([]);
  const [isApplyingPreset, setIsApplyingPreset] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [strategyRules, setStrategyRules] = useState<StoredStrategyRules | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [marketData, setMarketData] = useState<Record<string, MarketDataSummary>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    if (!selectedPortfolio) return;

    setIsLoading(true);
    try {
      const [budgetData, rulesData, allocationsData, presetsData] = await Promise.all([
        budgetApi.getCurrent(selectedPortfolio.id),
        strategyApi.getStrategyRules(selectedPortfolio.id).catch(() => null),
        allocationApi.getAll(selectedPortfolio.id).catch(() => []),
        portfolioApi.getBudgetPresets(selectedPortfolio.id).catch(() => []),
      ]);
      setBudgetPresets(presetsData);
      setCurrentBudget(budgetData);
      setStrategyRules(rulesData);
      setAllocations(allocationsData.filter((a) => a.isActive));

      const symbols = rulesData?.stocks?.length
        ? rulesData.stocks.map((s) => s.symbol)
        : allocationsData.filter((a) => a.isActive).map((a) => a.symbol);

      if (symbols.length > 0) {
        try {
          const syncResult = await marketDataApi.sync([], selectedPortfolio.id);
          if (syncResult?.symbolsSynced?.length) {
            toast.success(`Synced ${syncResult.symbolsSynced.length} symbols`);
          }
        } catch {
          // Sync may fail (e.g. rate limit); continue to fetch cached data
        }
        try {
          const summaries = await marketDataApi.getMultipleSummaries(symbols);
          const dataMap: Record<string, MarketDataSummary> = {};
          summaries.forEach((s) => {
            if (s?.symbol) dataMap[s.symbol] = s;
          });
          setMarketData(dataMap);
        } catch {
          setMarketData({});
        }
      } else {
        setMarketData({});
      }
    } catch (error) {
      toast.error('Failed to fetch strategy data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPortfolio?.id, selectedPortfolio?.totalCapital]);

  useEffect(() => {
    if (selectedPortfolio) {
      setBudgetInput(selectedPortfolio.totalCapital.toString());
      setStrategyRefInput(
        selectedPortfolio.strategyReferenceBudget != null
          ? selectedPortfolio.strategyReferenceBudget.toString()
          : selectedPortfolio.totalCapital.toString()
      );
      const defaults = getDefaultYearDates();
      setYearStartInput(selectedPortfolio.budgetYearStart ?? defaults.start);
      setYearEndInput(selectedPortfolio.budgetYearEnd ?? defaults.end);
    }
  }, [selectedPortfolio]);

  const handleSaveBudgetConfig = async () => {
    if (!selectedPortfolio) return;
    const totalCapital = parseFloat(budgetInput);
    if (isNaN(totalCapital) || totalCapital < 0) {
      toast.error('Please enter a valid budget');
      return;
    }
    if (!yearStartInput || !yearEndInput) {
      toast.error('Please set start and end dates');
      return;
    }
    const start = new Date(yearStartInput);
    const end = new Date(yearEndInput);
    if (start >= end) {
      toast.error('Start date must be before end date');
      return;
    }
    const strategyRef = strategyRefInput.trim() ? parseFloat(strategyRefInput) : totalCapital;
    if (isNaN(strategyRef) || strategyRef < 0) {
      toast.error('Please enter a valid strategy reference budget');
      return;
    }
    setIsSavingBudget(true);
    try {
      await portfolioApi.update(selectedPortfolio.id, {
        totalCapital,
        strategyReferenceBudget: strategyRef,
        budgetYearStart: yearStartInput,
        budgetYearEnd: yearEndInput,
      });
      await fetchPortfolios();
      await refreshPortfolio();
      await fetchData();
      toast.success('Budget settings saved');
      setIsBudgetModalOpen(false);
    } catch {
      toast.error('Failed to save');
    } finally {
      setIsSavingBudget(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleApplyPreset = async (presetId: string) => {
    if (!selectedPortfolio) return;
    setIsApplyingPreset(true);
    try {
      const updated = await portfolioApi.applyBudgetPreset(selectedPortfolio.id, presetId);
      updatePortfolio(updated);
      await fetchPortfolios();
      await fetchData();
      toast.success('Budget applied');
    } catch {
      toast.error('Failed to apply budget');
    } finally {
      setIsApplyingPreset(false);
    }
  };

  const handleAddBudget = async () => {
    if (!selectedPortfolio || !addBudgetName.trim()) {
      toast.error('Enter a name for the budget');
      return;
    }
    const totalCapital = parseFloat(addBudgetAmount);
    if (isNaN(totalCapital) || totalCapital < 0) {
      toast.error('Please enter a valid budget amount');
      return;
    }
    if (!addBudgetStart || !addBudgetEnd) {
      toast.error('Please set start and end dates');
      return;
    }
    const start = new Date(addBudgetStart);
    const end = new Date(addBudgetEnd);
    if (start >= end) {
      toast.error('Start date must be before end date');
      return;
    }
    setIsAddingBudget(true);
    try {
      await portfolioApi.createBudgetPreset(selectedPortfolio.id, {
        name: addBudgetName.trim(),
        totalCapital,
        strategyReferenceBudget: selectedPortfolio.strategyReferenceBudget ?? totalCapital,
        budgetYearStart: addBudgetStart,
        budgetYearEnd: addBudgetEnd,
      });
      await fetchData();
      setAddBudgetName('');
      setAddBudgetAmount('');
      setAddBudgetStart('');
      setAddBudgetEnd('');
      setIsAddBudgetModalOpen(false);
      toast.success('Budget created. Use "Switch to…" to apply it.');
    } catch {
      toast.error('Failed to add budget');
    } finally {
      setIsAddingBudget(false);
    }
  };

  const openAddBudgetModal = () => {
    const defaults = getDefaultYearDates();
    setAddBudgetName('');
    setAddBudgetAmount('');
    setAddBudgetStart(defaults.start);
    setAddBudgetEnd(defaults.end);
    setIsAddBudgetModalOpen(true);
  };

  const handleSaveAsPreset = async () => {
    if (!selectedPortfolio || !presetNameInput.trim()) {
      toast.error('Enter a name for the preset');
      return;
    }
    const totalCapital = parseFloat(budgetInput);
    if (isNaN(totalCapital) || totalCapital < 0) {
      toast.error('Please enter a valid budget first');
      return;
    }
    setIsSavingPreset(true);
    try {
      await portfolioApi.createBudgetPreset(selectedPortfolio.id, {
        name: presetNameInput.trim(),
        totalCapital,
        strategyReferenceBudget: selectedPortfolio.strategyReferenceBudget ?? totalCapital,
        budgetYearStart: yearStartInput || undefined,
        budgetYearEnd: yearEndInput || undefined,
      });
      await fetchData();
      setPresetNameInput('');
      toast.success('Preset saved');
    } catch {
      toast.error('Failed to save preset');
    } finally {
      setIsSavingPreset(false);
    }
  };

  if (!selectedPortfolio) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <Card className="w-96 text-center">
            <CardHeader>
              <CardTitle>No Portfolio Selected</CardTitle>
              <CardDescription>Select a portfolio to view your strategy.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
        <div className="space-y-2 -mt-0.5 w-full">
        {/* Compact header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Strategy</h1>
            <p className="text-xs text-muted-foreground">Your predefined buy strategy at each dip level</p>
          </div>
        </div>

        {/* Budget & Period - compact inline bar with preset switcher */}
        <div className="flex flex-wrap items-center gap-3 py-2 px-3 rounded-lg bg-muted/40 border text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium shrink-0">Budget:</span>
          <span className="font-semibold tabular-nums">${selectedPortfolio.totalCapital.toLocaleString()}</span>
          <span className="text-muted-foreground shrink-0">·</span>
          <span className="text-muted-foreground shrink-0">
            {formatDate(selectedPortfolio.budgetYearStart ?? getDefaultYearDates().start)}
            {' – '}
            {formatDate(selectedPortfolio.budgetYearEnd ?? getDefaultYearDates().end)}
          </span>
          {budgetPresets.length > 0 && (
            <>
              <span className="text-muted-foreground shrink-0">·</span>
              <Select
                value=""
                onValueChange={(v) => v && handleApplyPreset(v)}
                disabled={isApplyingPreset}
              >
                <SelectTrigger className="h-7 w-[140px] border-0 bg-transparent shadow-none focus:ring-0 text-xs">
                  <SelectValue placeholder="Switch to…" />
                </SelectTrigger>
                <SelectContent>
                  {budgetPresets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} (${p.totalCapital.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={openAddBudgetModal}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Budget
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
              setBudgetInput(selectedPortfolio.totalCapital.toString());
              setStrategyRefInput(
                selectedPortfolio.strategyReferenceBudget != null
                  ? selectedPortfolio.strategyReferenceBudget.toString()
                  : selectedPortfolio.totalCapital.toString()
              );
              const defaults = getDefaultYearDates();
              setYearStartInput(selectedPortfolio.budgetYearStart ?? defaults.start);
              setYearEndInput(selectedPortfolio.budgetYearEnd ?? defaults.end);
              setIsBudgetModalOpen(true);
              }}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Update
            </Button>
          </div>
        </div>

        <Dialog open={isAddBudgetModalOpen} onOpenChange={setIsAddBudgetModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Budget</DialogTitle>
              <DialogDescription>
                Create a new budget preset with name, amount, and period. It will appear in the list—use &quot;Switch to…&quot; to apply it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-budget-name">Name</Label>
                <Input
                  id="add-budget-name"
                  placeholder="e.g. 2025 Budget"
                  value={addBudgetName}
                  onChange={(e) => setAddBudgetName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-budget-amount">Budget ($)</Label>
                <Input
                  id="add-budget-amount"
                  type="number"
                  min={0}
                  step={100}
                  value={addBudgetAmount}
                  onChange={(e) => setAddBudgetAmount(e.target.value)}
                  placeholder="20000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-budget-start">Start</Label>
                <Input
                  id="add-budget-start"
                  type="date"
                  value={addBudgetStart}
                  onChange={(e) => setAddBudgetStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-budget-end">End</Label>
                <Input
                  id="add-budget-end"
                  type="date"
                  value={addBudgetEnd}
                  onChange={(e) => setAddBudgetEnd(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddBudgetModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddBudget} disabled={isAddingBudget}>
                {isAddingBudget ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Budget
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isBudgetModalOpen} onOpenChange={setIsBudgetModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Budget & Period</DialogTitle>
              <DialogDescription>
                Set your yearly budget and the period it applies to (e.g. Jan 1 – Dec 31)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="modal-budget">Budget ($)</Label>
                <Input
                  id="modal-budget"
                  type="number"
                  min={0}
                  step={100}
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  placeholder="20000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-strategy-ref">Strategy reference ($)</Label>
                <Input
                  id="modal-strategy-ref"
                  type="number"
                  min={0}
                  step={100}
                  value={strategyRefInput}
                  onChange={(e) => setStrategyRefInput(e.target.value)}
                  placeholder="e.g. 23639"
                />
                <p className="text-xs text-muted-foreground">
                  Budget your strategy was designed for. Amounts scale by current budget ÷ this value.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-year-start">Start</Label>
                <Input
                  id="modal-year-start"
                  type="date"
                  value={yearStartInput}
                  onChange={(e) => setYearStartInput(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-year-end">End</Label>
                <Input
                  id="modal-year-end"
                  type="date"
                  value={yearEndInput}
                  onChange={(e) => setYearEndInput(e.target.value)}
                />
              </div>
              <div className="pt-3 border-t">
                <Label className="text-muted-foreground text-xs">Save current as preset</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="e.g. 2024 Budget"
                    value={presetNameInput}
                    onChange={(e) => setPresetNameInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveAsPreset}
                    disabled={isSavingPreset || !presetNameInput.trim()}
                  >
                    {isSavingPreset ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBudgetModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveBudgetConfig} disabled={isSavingBudget}>
                {isSavingBudget ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Budget + Strategy: side by side to use space and fit all rows */}
        <div className="flex flex-col lg:flex-row gap-3 w-full">
        {/* Budget Info - compact card, narrower on large screens */}
        <Card className="overflow-hidden lg:w-72 lg:shrink-0">
          <CardHeader className="py-2 px-4 md:px-5">
            <CardTitle className="text-sm font-medium">Weekly Budget Plan</CardTitle>
            <CardDescription className="text-xs">
              Amount to buy per stock this week based on current dip level
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 px-4 md:px-5 pb-3">
            {isLoading ? (
              <Skeleton className="h-6 w-40" />
            ) : (() => {
              // Compute buy amounts from strategy rules + market data (aligned with strategy table)
              const buyPlan: { symbol: string; amount: number; dipLevel: string }[] = [];
              if (strategyRules?.stocks) {
                for (const stock of strategyRules.stocks) {
                  const live = marketData[stock.symbol];
                  const currentPrice = live?.latestPrice;
                  const levels = stock.levels ?? [];
                  const sortedLevels = [...levels].sort((a, b) => (a.thresholdPrice ?? 0) - (b.thresholdPrice ?? 0));
                  const activeLevel = currentPrice != null
                    ? sortedLevels.find((l) => currentPrice <= l.thresholdPrice)
                    : null;
                  // Use active dip level's Buy amount, or 10% (regular DCA) when no dip
                  const level = activeLevel ?? stock.levels.find((l) => l.dipPercent === 10);
                  const amount = level?.buyQuantity ?? 0;
                  const dipLabel = level?.dipLabel ?? '10%';
                  buyPlan.push({ symbol: stock.symbol, amount, dipLevel: dipLabel });
                }
              }
              const totalFromStrategy = buyPlan.reduce((sum, p) => sum + (p.amount ?? 0), 0);
              const total = buyPlan.length > 0
                ? totalFromStrategy
                : (currentBudget?.plannedAmount ?? allocations.reduce((sum, a) => sum + (a.weeklyDCA || 0), 0)) ?? 0;

              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div>
                      <p className="text-xs text-muted-foreground">Total this week</p>
                      <span className="text-xl font-bold">
                        ${(total ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    {currentBudget && (
                      <>
                        <Badge variant="outline">
                          ${(currentBudget.remainingAmount ?? 0).toLocaleString()} remaining
                        </Badge>
                        <Badge variant="secondary">
                          {(currentBudget.utilizationPercent ?? 0).toFixed(0)}% used
                        </Badge>
                      </>
                    )}
                  </div>
                  {buyPlan.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Buy per stock (from strategy at current dip):</p>
                      <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                        {buyPlan
                          .filter((p) => p.amount > 0)
                          .sort((a, b) => b.amount - a.amount)
                          .map((p) => (
                            <div
                              key={p.symbol}
                              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50 text-sm"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-medium shrink-0">{p.symbol}</span>
                                <span className="text-xs text-muted-foreground shrink-0">{p.dipLevel}</span>
                              </div>
                              <span className="tabular-nums font-semibold shrink-0">${p.amount}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : allocations.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Buy per stock (from allocations):</p>
                      <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                        {allocations
                          .filter((a) => (a.weeklyDCA || 0) > 0)
                          .sort((a, b) => (b.weeklyDCA || 0) - (a.weeklyDCA || 0))
                          .map((alloc) => (
                            <div key={alloc.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                              <span className="font-medium">{alloc.symbol}</span>
                              <span className="tabular-nums font-semibold">${(alloc.weeklyDCA || 0).toFixed(0)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No strategy or allocations. Add strategy rules or allocations to see weekly buy plan.
                    </p>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Strategy Template (stored buy plan rules) - flex-1 to fill remaining space */}
        {strategyRules && strategyRules.stocks.length > 0 && (
          <Card className="overflow-hidden lg:flex-1 lg:min-w-0">
            <CardHeader className="py-2 px-4 md:px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Your Strategy</CardTitle>
                  <CardDescription className="text-xs">
                    Predefined buy quantities at each dip level from 52-week high. Live prices from market data.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchData}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sync & Refresh'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 md:px-5 pb-3">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stock</TableHead>
                      <TableHead>Current Price</TableHead>
                      <TableHead>52-Week High</TableHead>
                      <TableHead>Dip %</TableHead>
                      <TableHead>10% Less</TableHead>
                      <TableHead>15% Less</TableHead>
                      <TableHead>20% Less</TableHead>
                      <TableHead>30% Less</TableHead>
                      <TableHead>More than 30%</TableHead>
                    </TableRow>
                    <TableRow className="border-0 hover:bg-transparent">
                      <TableCell className="py-0 font-medium"></TableCell>
                      <TableCell className="py-0 text-xs text-muted-foreground">Live</TableCell>
                      <TableCell className="py-0 text-xs text-muted-foreground">Strategy / Live</TableCell>
                      <TableCell className="py-0 text-xs text-muted-foreground">From high</TableCell>
                      <TableCell className="py-0 text-xs text-muted-foreground">Threshold | Buy</TableCell>
                      <TableCell className="py-0 text-xs text-muted-foreground">Threshold | Buy | Weekly Dip</TableCell>
                      <TableCell className="py-0 text-xs text-muted-foreground">Threshold | Buy | Weekly Dip</TableCell>
                      <TableCell className="py-0 text-xs text-muted-foreground">Threshold | Buy | Weekly Dip</TableCell>
                      <TableCell className="py-0 text-xs text-muted-foreground">Threshold | Buy | Weekly Dip</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {strategyRules.stocks.map((stock) => {
                      const live = marketData[stock.symbol];
                      const currentPrice = live?.latestPrice;
                      const live52wHigh = live?.fiftyTwoWeekHigh;
                      const dipFromHigh = live?.dipFromHigh ?? 0;
                      const has52wVariation = live52wHigh != null && stock.fiftyTwoWeekHigh != null && Math.abs(live52wHigh - stock.fiftyTwoWeekHigh) > 0.01;

                      // Find which dip level is active (current price at or below threshold = buy zone)
                      const sortedLevels = [...(stock.levels ?? [])].sort((a, b) => (a.thresholdPrice ?? 0) - (b.thresholdPrice ?? 0));
                      const activeDipLevel = currentPrice != null
                        ? sortedLevels.find((l) => currentPrice <= l.thresholdPrice)
                        : null;

                      return (
                        <TableRow key={stock.symbol} className="[&>td]:py-2">
                          <TableCell className="font-medium">{stock.symbol}</TableCell>
                          <TableCell>
                            {currentPrice != null ? (
                              <span className="font-semibold">${currentPrice.toFixed(2)}</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <span>${stock.fiftyTwoWeekHigh.toFixed(2)}</span>
                              {live52wHigh != null && (
                                <div className={cn(
                                  'text-xs',
                                  has52wVariation ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'
                                )}>
                                  Live: ${live52wHigh.toFixed(2)}
                                  {has52wVariation && ' ↑'}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {dipFromHigh !== 0 ? (
                              <span className={cn(
                                'font-medium',
                                dipFromHigh >= 20 ? 'text-red-600 dark:text-red-400' :
                                dipFromHigh >= 10 ? 'text-amber-600 dark:text-amber-400' :
                                'text-muted-foreground'
                              )}>
                                {dipFromHigh > 0 ? '-' : ''}{dipFromHigh.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          {[10, 15, 20, 30, 31].map((dip) => {
                            const level = stock.levels.find((l) => l.dipPercent === dip);
                            if (!level) return <TableCell key={dip}>-</TableCell>;
                            const weeklyDip = level.weeklyDipQuantity != null ? level.weeklyDipQuantity : 'NA';
                            const buyLabel = `$${level.buyQuantity ?? 0}`;
                            const isActiveLevel = activeDipLevel?.dipPercent === dip;
                            return (
                              <TableCell
                                key={dip}
                                className={cn(
                                  'text-sm transition-colors',
                                  isActiveLevel && 'bg-emerald-500/20 dark:bg-emerald-500/25 ring-2 ring-emerald-500/50 font-medium'
                                )}
                              >
                                <div className="space-y-0.5">
                                  <div className={cn(isActiveLevel && 'font-semibold')}>
                                    ${(level.thresholdPrice ?? 0).toFixed(2)}
                                    {isActiveLevel && (
                                      <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">●</span>
                                    )}
                                  </div>
                                  <div className="font-medium">{buyLabel}</div>
                                  {dip >= 15 && (
                                    <div className="text-muted-foreground text-xs">
                                      Weekly: {weeklyDip}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {Object.keys(marketData).length === 0 && strategyRules.stocks.length > 0 && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Click Refresh to sync live prices. If data is missing, the sync may have failed (check network or try again).
                </p>
              )}
            </CardContent>
          </Card>
        )}

        </div>
      </div>
    </AppShell>
  );
}
