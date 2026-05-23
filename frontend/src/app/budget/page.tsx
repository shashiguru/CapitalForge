'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { portfolioApi, allocationApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, Pencil, Check, X, RefreshCw, AlertTriangle } from 'lucide-react';
import type { BudgetPreset, Allocation } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function usd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function usd2(n: number) {
  return `$${n.toFixed(2)}`;
}

function getDefaultYearDates() {
  const y = new Date().getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

function computeFromBudget(budget: number, targetPct: number, coreR: number, dipR: number, crashR: number, dcaW: number) {
  const alloc = (budget * targetPct) / 100;
  const weeklyDCA = (alloc * coreR) / dcaW;
  const dip10 = weeklyDCA * 1;
  const dip20 = weeklyDCA * 3;
  const crash30 = weeklyDCA * 5;
  return { alloc, weeklyDCA, dip10, dip20, crash30 };
}

export default function BudgetPage() {
  const { selectedPortfolio, fetchPortfolios, refreshPortfolio, updatePortfolio } = usePortfolio();
  const [presets, setPresets] = useState<BudgetPreset[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Live what-if
  const [previewBudget, setPreviewBudget] = useState(0);
  const [isApplying, setIsApplying] = useState(false);

  // Add preset modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addName, setAddName] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addStart, setAddStart] = useState('');
  const [addEnd, setAddEnd] = useState('');

  // Edit preset modal
  const [editingPreset, setEditingPreset] = useState<BudgetPreset | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [isUpdatingPreset, setIsUpdatingPreset] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Edit active budget
  const [isEditActiveOpen, setIsEditActiveOpen] = useState(false);
  const [activeAmount, setActiveAmount] = useState('');
  const [activeStart, setActiveStart] = useState('');
  const [activeEnd, setActiveEnd] = useState('');
  const [isSavingActive, setIsSavingActive] = useState(false);

  // Allocation management state
  const [editingAllocId, setEditingAllocId] = useState<string | null>(null);
  const [editAllocPct, setEditAllocPct] = useState('');
  const [editAllocHigh, setEditAllocHigh] = useState('');
  const [editAllocAggressive, setEditAllocAggressive] = useState(false);
  const [savingAllocId, setSavingAllocId] = useState<string | null>(null);
  const [deletingAllocId, setDeletingAllocId] = useState<string | null>(null);
  // Add stock form
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [addSymbol, setAddSymbol] = useState('');
  const [addTargetPct, setAddTargetPct] = useState('');
  const [addHigh52, setAddHigh52] = useState('');
  const [addAggressive, setAddAggressive] = useState(false);
  const [addingStock, setAddingStock] = useState(false);

  const fetchData = useCallback(async () => {
    if (!selectedPortfolio) return;
    setIsLoading(true);
    try {
      const [presetsData, allocData] = await Promise.all([
        portfolioApi.getBudgetPresets(selectedPortfolio.id),
        allocationApi.getAll(selectedPortfolio.id).catch(() => []),
      ]);
      setPresets(presetsData);
      setAllocations(allocData);
    } catch { toast.error('Failed to load'); }
    finally { setIsLoading(false); }
  }, [selectedPortfolio?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (selectedPortfolio) {
      setPreviewBudget(selectedPortfolio.totalCapital);
      setActiveAmount(selectedPortfolio.totalCapital.toString());
      const d = getDefaultYearDates();
      setActiveStart(selectedPortfolio.budgetYearStart ?? d.start);
      setActiveEnd(selectedPortfolio.budgetYearEnd ?? d.end);
    }
  }, [selectedPortfolio]);

  const handleApplyPreset = async (presetId: string) => {
    if (!selectedPortfolio) return;
    setIsApplying(true);
    try {
      const updated = await portfolioApi.applyBudgetPreset(selectedPortfolio.id, presetId);
      updatePortfolio(updated);
      await fetchPortfolios();
      await fetchData();
      toast.success('Budget applied');
    } catch { toast.error('Failed to apply'); }
    finally { setIsApplying(false); }
  };

  const handleApplyPreviewBudget = async () => {
    if (!selectedPortfolio) return;
    setIsSavingActive(true);
    try {
      const updated = await portfolioApi.update(selectedPortfolio.id, {
        totalCapital: previewBudget,
        budgetYearStart: activeStart || undefined,
        budgetYearEnd: activeEnd || undefined,
      });
      updatePortfolio(updated);
      await fetchPortfolios();
      await allocationApi.recalculateBuckets(selectedPortfolio.id);
      await fetchData();
      toast.success('Budget updated — allocations recalculated');
    } catch { toast.error('Failed to update'); }
    finally { setIsSavingActive(false); }
  };

  const handleAddPreset = async () => {
    if (!selectedPortfolio || !addName.trim()) { toast.error('Enter a name'); return; }
    const totalCapital = parseFloat(addAmount);
    if (isNaN(totalCapital) || totalCapital <= 0) { toast.error('Invalid amount'); return; }
    setIsAdding(true);
    try {
      await portfolioApi.createBudgetPreset(selectedPortfolio.id, {
        name: addName.trim(), totalCapital,
        budgetYearStart: addStart || undefined,
        budgetYearEnd: addEnd || undefined,
      });
      await fetchData();
      setIsAddModalOpen(false); setAddName(''); setAddAmount(''); setAddStart(''); setAddEnd('');
      toast.success('Budget saved');
    } catch { toast.error('Failed'); }
    finally { setIsAdding(false); }
  };

  const handleUpdatePreset = async () => {
    if (!selectedPortfolio || !editingPreset) return;
    const totalCapital = parseFloat(editAmount);
    if (isNaN(totalCapital) || totalCapital <= 0) { toast.error('Invalid amount'); return; }
    setIsUpdatingPreset(true);
    try {
      await portfolioApi.updateBudgetPreset(selectedPortfolio.id, editingPreset.id, {
        name: editName.trim(), totalCapital,
        budgetYearStart: editStart || undefined,
        budgetYearEnd: editEnd || undefined,
      });
      await fetchData(); setEditingPreset(null);
      toast.success('Updated');
    } catch { toast.error('Failed'); }
    finally { setIsUpdatingPreset(false); }
  };

  const handleDeletePreset = async (id: string) => {
    if (!selectedPortfolio) return;
    setIsDeleting(id);
    try {
      await portfolioApi.deleteBudgetPreset(selectedPortfolio.id, id);
      await fetchData(); toast.success('Deleted');
    } catch { toast.error('Failed'); }
    finally { setIsDeleting(null); }
  };

  const handleSaveActive = async () => {
    if (!selectedPortfolio) return;
    const totalCapital = parseFloat(activeAmount);
    if (isNaN(totalCapital) || totalCapital <= 0) { toast.error('Invalid amount'); return; }
    setIsSavingActive(true);
    try {
      const updated = await portfolioApi.update(selectedPortfolio.id, {
        totalCapital,
        budgetYearStart: activeStart || undefined,
        budgetYearEnd: activeEnd || undefined,
      });
      updatePortfolio(updated); await fetchPortfolios();
      await allocationApi.recalculateBuckets(selectedPortfolio.id);
      await fetchData();
      setIsEditActiveOpen(false);
      toast.success('Budget updated');
    } catch { toast.error('Failed'); }
    finally { setIsSavingActive(false); }
  };

  const handleSaveAlloc = async (id: string) => {
    const pct = parseFloat(editAllocPct);
    if (isNaN(pct) || pct <= 0 || pct > 100) { toast.error('Target % must be 0–100'); return; }
    setSavingAllocId(id);
    try {
      const updated = await allocationApi.update(id, {
        targetPercentage: pct,
        ...(editAllocHigh ? { fiftyTwoWeekHigh: parseFloat(editAllocHigh) } : {}),
        isAggressive: editAllocAggressive,
      });
      setAllocations((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
      setEditingAllocId(null);
      toast.success(`${updated.symbol} updated`);
    } catch { toast.error('Failed to update'); }
    finally { setSavingAllocId(null); }
  };

  const handleDeleteAlloc = async (id: string) => {
    const alloc = allocations.find((a) => a.id === id);
    if (!confirm(`Remove ${alloc?.symbol} from portfolio?`)) return;
    setDeletingAllocId(id);
    try {
      await allocationApi.delete(id);
      setAllocations((prev) => prev.filter((a) => a.id !== id));
      toast.success(`${alloc?.symbol ?? 'Stock'} removed`);
    } catch { toast.error('Failed to remove'); }
    finally { setDeletingAllocId(null); }
  };

  const handleAddStock = async () => {
    if (!selectedPortfolio) return;
    const sym = addSymbol.trim().toUpperCase();
    const pct = parseFloat(addTargetPct);
    if (!sym) { toast.error('Symbol required'); return; }
    if (isNaN(pct) || pct <= 0 || pct > 100) { toast.error('Target % must be 0–100'); return; }
    setAddingStock(true);
    try {
      const created = await allocationApi.create(selectedPortfolio.id, {
        symbol: sym,
        targetPercentage: pct,
        ...(addHigh52 ? { fiftyTwoWeekHigh: parseFloat(addHigh52) } : {}),
        isAggressive: addAggressive,
      });
      setAllocations((prev) => [...prev, created]);
      setAddSymbol(''); setAddTargetPct(''); setAddHigh52(''); setAddAggressive(false);
      setAddStockOpen(false);
      toast.success(`${sym} added`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to add stock');
    } finally { setAddingStock(false); }
  };

  if (!selectedPortfolio) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="label-caps">No portfolio selected</p>
        </div>
      </AppShell>
    );
  }

  const coreR = selectedPortfolio.coreRatio ?? 0.60;
  const dipR = selectedPortfolio.dipRatio ?? 0.30;
  const crashR = selectedPortfolio.crashRatio ?? 0.10;
  const dcaW = selectedPortfolio.dcaWeeksPerYear ?? 48;
  const currentBudget = selectedPortfolio.totalCapital;
  const sliderMax = Math.max(currentBudget * 3, 100000);

  const isCurrentBudget = (p: BudgetPreset) =>
    Number(p.totalCapital) === Number(currentBudget) &&
    (p.budgetYearStart ?? '').slice(0, 10) === (selectedPortfolio.budgetYearStart ?? '').slice(0, 10);

  return (
    <AppShell>
      {/* ─── Header ─── */}
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-normal">Budget Control</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The budget is the single control knob. Change one number — everything downstream recalculates instantly.
        </p>
      </div>

      {/* ─── Current Budget + What-If ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Current budget */}
        <div className="bg-card border border-border rounded-sm p-5">
          <p className="label-caps mb-3">Current Budget</p>
          <div className="flex items-baseline justify-between">
            <span className="text-4xl font-serif font-normal tabular-nums">{usd(currentBudget)}</span>
            <button
              onClick={() => {
                setActiveAmount(currentBudget.toString());
                const d = getDefaultYearDates();
                setActiveStart(selectedPortfolio.budgetYearStart ?? d.start);
                setActiveEnd(selectedPortfolio.budgetYearEnd ?? d.end);
                setIsEditActiveOpen(true);
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              <Pencil className="h-3 w-3 inline mr-1" />Edit
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Active across {allocations.length} position{allocations.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* What-if slider */}
        <div className="bg-card border border-border rounded-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="label-caps flex items-center gap-1.5">
              <span>⚙</span> Budget Preview · Live What-If
            </p>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="range"
              min={1000}
              max={sliderMax}
              step={500}
              value={previewBudget}
              onChange={(e) => setPreviewBudget(Number(e.target.value))}
              className="flex-1 h-1 accent-foreground"
            />
            <input
              type="number"
              value={previewBudget}
              onChange={(e) => setPreviewBudget(Number(e.target.value))}
              className="w-24 h-8 text-sm text-right tabular-nums border border-border rounded-sm px-2 bg-transparent"
            />
          </div>
          <button
            onClick={handleApplyPreviewBudget}
            disabled={isSavingActive || previewBudget === currentBudget}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-foreground text-background rounded-sm hover:bg-foreground/90 disabled:opacity-40 transition-colors"
          >
            {isSavingActive && <Loader2 className="h-3 w-3 animate-spin" />}
            Apply budget
          </button>

          {/* Preset chips */}
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreviewBudget(p.totalCapital)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors',
                    previewBudget === p.totalCapital
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-transparent border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                  )}
                >
                  {p.name} · {usd(p.totalCapital)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Combined Portfolio & Derived Values table ─── */}
      {(() => {
        const totalPct = allocations.reduce((s, a) => s + Number(a.targetPercentage), 0);
        const isOver = totalPct > 100.05;
        const isUnder = totalPct < 99.95 && allocations.length > 0;
        const changed = previewBudget !== currentBudget;

        return (
          <div className="bg-card border border-border rounded-sm mb-6">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-sm font-semibold">Portfolio Composition</h2>
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded tabular-nums',
                  isOver ? 'bg-red-100 text-red-700' : isUnder ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                )}>
                  {totalPct.toFixed(1)}% allocated
                </span>
                {(isOver || isUnder) && (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {isOver ? 'Exceeds 100%' : `${(100 - totalPct).toFixed(1)}% unallocated`}
                  </span>
                )}
                {changed && (
                  <span className="text-xs text-muted-foreground">
                    Preview: {usd(currentBudget)} → <span className="font-semibold text-foreground">{usd(previewBudget)}</span>
                  </span>
                )}
              </div>
              {addStockOpen ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Input placeholder="SYMBOL" value={addSymbol}
                    onChange={(e) => setAddSymbol(e.target.value.toUpperCase())}
                    className="h-8 w-24 text-sm uppercase font-semibold" maxLength={10}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddStock()} autoFocus />
                  <div className="relative">
                    <Input placeholder="Target %" value={addTargetPct}
                      onChange={(e) => setAddTargetPct(e.target.value)}
                      className="h-8 w-24 text-sm pr-5" type="number" min={0} max={100} step={0.1} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <Input placeholder="52-wk High" value={addHigh52}
                    onChange={(e) => setAddHigh52(e.target.value)}
                    className="h-8 w-28 text-sm" type="number" min={0} step={0.01} />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <button onClick={() => setAddAggressive(!addAggressive)}
                      className={cn('w-8 h-4 rounded-full transition-colors relative', addAggressive ? 'bg-foreground' : 'bg-border')}>
                      <span className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow-sm', addAggressive ? 'left-4' : 'left-0.5')} />
                    </button>
                    Aggressive
                  </label>
                  <Button size="sm" className="h-8 text-xs gap-1" onClick={handleAddStock} disabled={addingStock}>
                    {addingStock ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddStockOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button variant="default" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setAddStockOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Stock
                </Button>
              )}
            </div>

            {/* Unified table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="py-2.5 px-5 label-caps text-left">Symbol</th>
                    <th className="py-2.5 px-5 label-caps text-right">Target %</th>
                    <th className="py-2.5 px-5 label-caps text-right">Alloc USD</th>
                    <th className="py-2.5 px-5 label-caps text-right">Weekly DCA</th>
                    <th className="py-2.5 px-5 label-caps text-right">10% Dip (1×)</th>
                    <th className="py-2.5 px-5 label-caps text-right">20% Dip (3×)</th>
                    <th className="py-2.5 px-5 label-caps text-right">30% Crash (5×)</th>
                    <th className="py-2.5 px-5 label-caps text-right">52-wk High</th>
                    <th className="py-2.5 px-5 label-caps text-center">Aggr.</th>
                    <th className="py-2.5 px-5 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? [1,2,3].map((i) => (
                        <tr key={i} className="border-b border-border">
                          <td colSpan={10} className="px-5 py-3"><Skeleton className="h-4 w-full" /></td>
                        </tr>
                      ))
                    : allocations.length === 0
                    ? (
                        <tr>
                          <td colSpan={10} className="px-5 py-8 text-center text-muted-foreground text-sm">
                            No stocks yet — click <strong>Add Stock</strong> to begin.
                          </td>
                        </tr>
                      )
                    : allocations.map((alloc) => {
                        const isEditing = editingAllocId === alloc.id;
                        const cur = computeFromBudget(currentBudget, alloc.targetPercentage, coreR, dipR, crashR, dcaW);
                        const pre = computeFromBudget(previewBudget, alloc.targetPercentage, coreR, dipR, crashR, dcaW);

                        const DerivedCell = ({ curVal, preVal }: { curVal: number; preVal: number }) => (
                          <td className="py-3 px-5 text-right tabular-nums">
                            {changed ? (
                              <>
                                <span className="text-muted-foreground line-through text-xs">{usd2(curVal)}</span>
                                <span className="block font-semibold">{usd2(preVal)}</span>
                              </>
                            ) : (
                              <span>{usd2(curVal)}</span>
                            )}
                          </td>
                        );

                        return (
                          <tr key={alloc.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                            <td className="py-3 px-5">
                              <p className="font-semibold">{alloc.symbol}</p>
                              {alloc.companyName && <p className="text-[11px] text-muted-foreground">{alloc.companyName}</p>}
                            </td>
                            {/* Target % — editable */}
                            <td className="py-3 px-5 text-right">
                              {isEditing ? (
                                <Input value={editAllocPct} onChange={(e) => setEditAllocPct(e.target.value)}
                                  className="h-7 w-20 text-right text-sm ml-auto" type="number" min={0} max={100} step={0.1} />
                              ) : (
                                <span className="font-semibold tabular-nums">{Number(alloc.targetPercentage).toFixed(1)}%</span>
                              )}
                            </td>
                            {/* Alloc USD */}
                            <td className="py-3 px-5 text-right tabular-nums">
                              {changed ? (
                                <>
                                  <span className="text-muted-foreground line-through text-xs">{usd(cur.alloc)}</span>
                                  <span className="block font-semibold">{usd(pre.alloc)}</span>
                                </>
                              ) : <span>{usd(cur.alloc)}</span>}
                            </td>
                            {/* Weekly DCA */}
                            <td className="py-3 px-5 text-right tabular-nums">
                              {changed ? (
                                <>
                                  <span className="text-muted-foreground line-through text-xs">{usd2(cur.weeklyDCA)}</span>
                                  <span className="block font-semibold">{usd2(pre.weeklyDCA)}</span>
                                </>
                              ) : <span>{usd2(cur.weeklyDCA)}</span>}
                            </td>
                            <DerivedCell curVal={cur.dip10} preVal={pre.dip10} />
                            <DerivedCell curVal={cur.dip20} preVal={pre.dip20} />
                            <DerivedCell curVal={cur.crash30} preVal={pre.crash30} />
                            {/* 52-wk High — editable */}
                            <td className="py-3 px-5 text-right">
                              {isEditing ? (
                                <Input value={editAllocHigh} onChange={(e) => setEditAllocHigh(e.target.value)}
                                  className="h-7 w-24 text-right text-sm ml-auto" type="number" min={0} step={0.01} placeholder="e.g. 212" />
                              ) : (
                                <span className="tabular-nums text-muted-foreground">
                                  {alloc.fiftyTwoWeekHigh ? usd2(alloc.fiftyTwoWeekHigh) : '—'}
                                </span>
                              )}
                            </td>
                            {/* Aggressive toggle */}
                            <td className="py-3 px-5 text-center">
                              {isEditing ? (
                                <button onClick={() => setEditAllocAggressive(!editAllocAggressive)}
                                  className={cn('w-10 h-5 rounded-full transition-colors relative mx-auto block', editAllocAggressive ? 'bg-foreground' : 'bg-border')}>
                                  <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm', editAllocAggressive ? 'left-5' : 'left-0.5')} />
                                </button>
                              ) : (
                                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
                                  alloc.isAggressive ? 'bg-purple-100 text-purple-700' : 'bg-muted text-muted-foreground')}>
                                  {alloc.isAggressive ? 'YES' : 'NO'}
                                </span>
                              )}
                            </td>
                            {/* Actions */}
                            <td className="py-3 px-5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {isEditing ? (
                                  <>
                                    <Button size="sm" className="h-7 px-2" onClick={() => handleSaveAlloc(alloc.id)} disabled={savingAllocId === alloc.id}>
                                      {savingAllocId === alloc.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingAllocId(null)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="sm" variant="ghost" className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => { setEditingAllocId(alloc.id); setEditAllocPct(String(alloc.targetPercentage)); setEditAllocHigh(String(alloc.fiftyTwoWeekHigh ?? '')); setEditAllocAggressive(alloc.isAggressive ?? false); }}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleDeleteAlloc(alloc.id)} disabled={deletingAllocId === alloc.id}>
                                      {deletingAllocId === alloc.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                  {/* Totals row */}
                  {!isLoading && allocations.length > 0 && (() => {
                    const totCur = allocations.reduce((s, a) => {
                      const c = computeFromBudget(currentBudget, a.targetPercentage, coreR, dipR, crashR, dcaW);
                      return { alloc: s.alloc + c.alloc, dca: s.dca + c.weeklyDCA, d10: s.d10 + c.dip10, d20: s.d20 + c.dip20, c30: s.c30 + c.crash30 };
                    }, { alloc: 0, dca: 0, d10: 0, d20: 0, c30: 0 });
                    const totPre = allocations.reduce((s, a) => {
                      const p = computeFromBudget(previewBudget, a.targetPercentage, coreR, dipR, crashR, dcaW);
                      return { alloc: s.alloc + p.alloc, dca: s.dca + p.weeklyDCA, d10: s.d10 + p.dip10, d20: s.d20 + p.dip20, c30: s.c30 + p.crash30 };
                    }, { alloc: 0, dca: 0, d10: 0, d20: 0, c30: 0 });
                    const TotCell = ({ c, p }: { c: number; p: number }) => (
                      <td className="py-3 px-5 text-right tabular-nums">
                        {changed ? <><span className="text-muted-foreground line-through text-xs">{usd2(c)}</span><span className="block">{usd2(p)}</span></> : usd2(c)}
                      </td>
                    );
                    return (
                      <tr className="bg-muted/30 border-t-2 border-border font-semibold text-sm">
                        <td className="py-3 px-5 text-xs uppercase tracking-wider text-muted-foreground">Total</td>
                        <td className={cn('py-3 px-5 text-right tabular-nums', isOver ? 'text-red-600' : isUnder ? 'text-amber-600' : 'text-emerald-600')}>
                          {totalPct.toFixed(1)}%
                        </td>
                        <td className="py-3 px-5 text-right tabular-nums">
                          {changed ? <><span className="text-muted-foreground line-through text-xs">{usd(totCur.alloc)}</span><span className="block">{usd(totPre.alloc)}</span></> : usd(totCur.alloc)}
                        </td>
                        <TotCell c={totCur.dca} p={totPre.dca} />
                        <TotCell c={totCur.d10} p={totPre.d10} />
                        <TotCell c={totCur.d20} p={totPre.d20} />
                        <TotCell c={totCur.c30} p={totPre.c30} />
                        <td colSpan={3} />
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ─── Bottom info cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Bucket Ratios */}
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="label-caps mb-3">Bucket Ratios</p>
          {[
            { name: 'Core (regular DCA)', ratio: coreR, color: 'bg-blue-500' },
            { name: 'Dip (20–30%)', ratio: dipR, color: 'bg-amber-500' },
            { name: 'Crash (≥ 30%)', ratio: crashR, color: 'bg-red-500' },
          ].map((b) => (
            <div key={b.name} className="mb-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{b.name}</span>
                <span className="font-semibold">{Math.round(b.ratio * 100)}%</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', b.color)} style={{ width: `${b.ratio * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* DCA Cadence */}
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="label-caps mb-3">DCA Cadence</p>
          <p className="text-3xl font-serif font-normal">{dcaW}</p>
          <p className="text-sm text-muted-foreground mt-1">weeks/yr</p>
          <p className="text-xs text-muted-foreground mt-3">
            Excel default. Switch to 52 if you prefer calendar weeks.
          </p>
        </div>

        {/* Budget Presets */}
        <div className="bg-card border border-border rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="label-caps">Saved Budgets</p>
            <button
              onClick={() => {
                const d = getDefaultYearDates();
                setAddName(''); setAddAmount('');
                setAddStart(d.start); setAddEnd(d.end);
                setIsAddModalOpen(true);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5 inline mr-0.5" />Add
            </button>
          </div>
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div>
          ) : presets.length === 0 ? (
            <p className="text-xs text-muted-foreground">No saved budgets yet.</p>
          ) : (
            <div className="space-y-1.5">
              {presets.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isCurrentBudget(p) && <Check className="h-3 w-3 text-emerald-600 shrink-0" />}
                    <span className={cn('text-xs truncate', isCurrentBudget(p) ? 'font-semibold' : 'text-muted-foreground')}>
                      {p.name}
                    </span>
                    <span className="text-xs tabular-nums">{usd(p.totalCapital)}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleApplyPreset(p.id)}
                      disabled={isCurrentBudget(p) || isApplying}
                      className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors font-medium"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => {
                        setEditingPreset(p); setEditName(p.name);
                        setEditAmount(p.totalCapital.toString());
                        setEditStart((p.budgetYearStart ?? '').slice(0, 10));
                        setEditEnd((p.budgetYearEnd ?? '').slice(0, 10));
                      }}
                      className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeletePreset(p.id)}
                      disabled={isDeleting === p.id}
                      className="p-0.5 text-muted-foreground hover:text-red-600 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Dialogs ─── */}

      {/* Add preset */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Budget</DialogTitle>
            <DialogDescription>Save a named budget scenario.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input className="h-9 text-sm" placeholder="2025 baseline" value={addName} onChange={(e) => setAddName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Budget ($)</Label>
              <Input className="h-9 text-sm" type="number" min={0} step={500} placeholder="23639" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start</Label>
                <Input className="h-9 text-sm" type="date" value={addStart} onChange={(e) => setAddStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End</Label>
                <Input className="h-9 text-sm" type="date" value={addEnd} onChange={(e) => setAddEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPreset} disabled={isAdding}>
              {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit preset */}
      <Dialog open={!!editingPreset} onOpenChange={(o) => !o && setEditingPreset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input className="h-9 text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Budget ($)</Label>
              <Input className="h-9 text-sm" type="number" min={0} step={500} value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start</Label>
                <Input className="h-9 text-sm" type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End</Label>
                <Input className="h-9 text-sm" type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPreset(null)}>Cancel</Button>
            <Button onClick={handleUpdatePreset} disabled={isUpdatingPreset}>
              {isUpdatingPreset && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit active budget */}
      <Dialog open={isEditActiveOpen} onOpenChange={setIsEditActiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Active Budget</DialogTitle>
            <DialogDescription>Changes trigger full allocation recalculation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Budget ($)</Label>
              <Input className="h-9 text-sm" type="number" min={0} step={500} value={activeAmount} onChange={(e) => setActiveAmount(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start</Label>
                <Input className="h-9 text-sm" type="date" value={activeStart} onChange={(e) => setActiveStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End</Label>
                <Input className="h-9 text-sm" type="date" value={activeEnd} onChange={(e) => setActiveEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditActiveOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveActive} disabled={isSavingActive}>
              {isSavingActive && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
