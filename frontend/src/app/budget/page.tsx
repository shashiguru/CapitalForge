'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { portfolioApi, allocationApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
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
import type { BudgetPreset, BudgetPresetStock, Allocation } from '@/lib/types';
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

type CompositionDraft = {
  key: string;
  id?: string;
  symbol: string;
  targetPercentage: string;
  fiftyTwoWeekHigh: string;
  isAggressive: boolean;
  isAddRow?: boolean;
};

const ADD_ROW_KEY = '__add__';

function createAddRow(): CompositionDraft {
  return {
    key: ADD_ROW_KEY,
    symbol: '',
    targetPercentage: '',
    fiftyTwoWeekHigh: '',
    isAggressive: false,
    isAddRow: true,
  };
}

function allocationsToDraft(allocs: Allocation[]): CompositionDraft[] {
  return [
    ...allocs.map((a) => ({
      key: a.id,
      id: a.id,
      symbol: a.symbol,
      targetPercentage: String(a.targetPercentage),
      fiftyTwoWeekHigh: a.fiftyTwoWeekHigh ? String(a.fiftyTwoWeekHigh) : '',
      isAggressive: a.isAggressive ?? false,
    })),
    createAddRow(),
  ];
}

function presetStocksToDraft(stocks: BudgetPresetStock[]): CompositionDraft[] {
  return [
    ...stocks.map((s) => ({
      key: s.id,
      id: s.id,
      symbol: s.symbol,
      targetPercentage: String(s.targetPercentage),
      fiftyTwoWeekHigh: s.fiftyTwoWeekHigh ? String(s.fiftyTwoWeekHigh) : '',
      isAggressive: s.isAggressive ?? false,
    })),
    createAddRow(),
  ];
}

type CompositionBaseline = {
  symbol: string;
  targetPercentage: number;
  fiftyTwoWeekHigh?: number | null;
  isAggressive?: boolean;
};

function draftTotalPct(rows: CompositionDraft[]) {
  return rows
    .filter((r) => r.symbol.trim())
    .reduce((s, r) => s + (parseFloat(r.targetPercentage) || 0), 0);
}

function isCompositionDirty(draft: CompositionDraft[], baseline: CompositionBaseline[]) {
  const addRow = draft.find((r) => r.isAddRow);
  if (addRow?.symbol.trim() || addRow?.targetPercentage.trim()) return true;

  const committed = draft.filter((r) => !r.isAddRow && r.symbol.trim());
  if (committed.length !== baseline.length) return true;

  for (const row of committed) {
    const saved = baseline.find((x) => x.symbol === row.symbol);
    if (!saved) return true;
    if (Math.abs(Number(saved.targetPercentage) - parseFloat(row.targetPercentage)) > 0.01) return true;
    const high = saved.fiftyTwoWeekHigh ? String(saved.fiftyTwoWeekHigh) : '';
    if (high !== row.fiftyTwoWeekHigh) return true;
    if (!!saved.isAggressive !== row.isAggressive) return true;
  }
  return false;
}

function balanceDraftTo100(rows: CompositionDraft[]) {
  const total = draftTotalPct(rows);
  if (total <= 0) return rows;
  const factor = 100 / total;
  return rows.map((r) => ({
    ...r,
    targetPercentage: String(Math.round((parseFloat(r.targetPercentage) || 0) * factor * 10) / 10),
  }));
}

/** Scale existing rows proportionally to make room for a new stock's target % */
function makeRoomForNew(rows: CompositionDraft[], newRowKey: string, newPct: number) {
  const existing = rows.filter((r) => r.key !== newRowKey);
  const existingTotal = existing.reduce((s, r) => s + (parseFloat(r.targetPercentage) || 0), 0);
  if (existingTotal <= 0) return rows;
  const factor = (100 - newPct) / existingTotal;
  return rows.map((r) => {
    if (r.key === newRowKey) return { ...r, targetPercentage: String(newPct) };
    return {
      ...r,
      targetPercentage: String(Math.round((parseFloat(r.targetPercentage) || 0) * factor * 10) / 10),
    };
  });
}

export default function BudgetPage() {
  const { selectedPortfolio, fetchPortfolios, refreshPortfolio, updatePortfolio } = usePortfolio();
  const [presets, setPresets] = useState<BudgetPreset[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetComposition, setPresetComposition] = useState<BudgetPresetStock[]>([]);
  const [activeAllocationsCount, setActiveAllocationsCount] = useState(0);
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

  // Portfolio composition — always inline editable with add row at bottom
  const [draftRows, setDraftRows] = useState<CompositionDraft[]>([createAddRow()]);
  const [isSavingComposition, setIsSavingComposition] = useState(false);

  const applyPresetToEditor = (preset: BudgetPreset, stocks: BudgetPresetStock[]) => {
    setEditingPresetId(preset.id);
    setPresetComposition(stocks);
    setDraftRows(presetStocksToDraft(stocks));
    setPreviewBudget(preset.totalCapital);
  };

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
      setActiveAllocationsCount(allocData.filter((a) => a.isActive).length);

      const sorted = [...presetsData].sort((a, b) =>
        (a.budgetYearStart ?? a.name).localeCompare(b.budgetYearStart ?? b.name),
      );

      const matchActive = (p: BudgetPreset) =>
        Number(p.totalCapital) === Number(selectedPortfolio.totalCapital) &&
        (p.budgetYearStart ?? '').slice(0, 10) ===
          (selectedPortfolio.budgetYearStart ?? '').slice(0, 10);

      const targetPreset =
        sorted.find((p) => p.id === editingPresetId) ??
        sorted.find(matchActive) ??
        sorted[0];

      if (targetPreset) {
        const stocks = await portfolioApi.getBudgetPresetCompositionWithFallback(
          selectedPortfolio.id,
          targetPreset.id,
          allocData,
        );
        applyPresetToEditor(targetPreset, stocks);
      } else {
        setEditingPresetId(null);
        setPresetComposition([]);
        setDraftRows(allocationsToDraft(allocData.filter((a) => a.isActive)));
      }
    } catch {
      toast.error('Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedPortfolio?.id,
    selectedPortfolio?.totalCapital,
    selectedPortfolio?.budgetYearStart,
    editingPresetId,
  ]);

  const selectEditingPreset = async (preset: BudgetPreset) => {
    if (!selectedPortfolio) return;
    if (
      isCompositionDirty(draftRows, presetComposition) &&
      !window.confirm('Discard unsaved changes to this plan?')
    ) {
      return;
    }
    try {
      const stocks = await portfolioApi.getBudgetPresetCompositionWithFallback(
        selectedPortfolio.id,
        preset.id,
        allocations,
      );
      applyPresetToEditor(preset, stocks);
    } catch {
      toast.error('Failed to load plan');
    }
  };

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

  const resetDraftFromPreset = () => {
    setDraftRows(presetStocksToDraft(presetComposition));
  };

  const updateDraftRow = (key: string, patch: Partial<CompositionDraft>) => {
    setDraftRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeDraftRow = (key: string) => {
    setDraftRows((prev) => {
      const without = prev.filter((r) => r.key !== key);
      if (without.some((r) => r.isAddRow)) return without;
      return [...without, createAddRow()];
    });
  };

  const handleSaveComposition = async () => {
    if (!selectedPortfolio) return;

    if (!editingPresetId) {
      toast.error('Select a budget year plan first');
      return;
    }

    const rows = draftRows.filter((r) => r.symbol.trim());
    if (rows.length === 0) {
      toast.error('Add at least one stock');
      return;
    }

    const symbols = rows.map((r) => r.symbol.trim().toUpperCase());
    if (new Set(symbols).size !== symbols.length) {
      toast.error('Duplicate symbols are not allowed');
      return;
    }

    for (const row of rows) {
      const pct = parseFloat(row.targetPercentage);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        toast.error(`${row.symbol}: target % must be between 0.1 and 100`);
        return;
      }
    }

    const total = draftTotalPct(rows);
    if (total > 100.05) {
      toast.error(`Total is ${total.toFixed(1)}% — reduce allocations or use "Balance to 100%"`);
      return;
    }

    setIsSavingComposition(true);
    try {
      const saved = await portfolioApi.saveBudgetPresetComposition(
        selectedPortfolio.id,
        editingPresetId,
        rows.map((r) => ({
          symbol: r.symbol.trim().toUpperCase(),
          targetPercentage: parseFloat(r.targetPercentage),
          isAggressive: r.isAggressive,
          fiftyTwoWeekHigh: r.fiftyTwoWeekHigh ? parseFloat(r.fiftyTwoWeekHigh) : undefined,
        })),
      );
      setPresetComposition(saved);
      setDraftRows(presetStocksToDraft(saved));
      toast.success('Plan composition saved');
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg ?? 'Failed to save allocations');
    } finally {
      setIsSavingComposition(false);
    }
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

  const selectedPlanPreset = presets.find((p) => p.id === editingPresetId) ?? null;
  const editingPresetBudget = selectedPlanPreset?.totalCapital ?? previewBudget;

  return (
    <AppShell>
      <PageHeader
        title="Budget Control"
        subtitle="Set budget and stock list per year. Each saved plan keeps its own composition — apply a plan to activate it for strategy."
      />

      {/* ─── Current Budget + What-If ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Current budget */}
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="label-caps mb-2">Current Budget</p>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl md:text-4xl font-serif font-normal tabular-nums">{usd(currentBudget)}</span>
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
          <p className="text-[11px] md:text-sm text-muted-foreground mt-1">
            Active across {activeAllocationsCount} position{activeAllocationsCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* What-if slider */}
        <div className="bg-card border border-border rounded-sm p-4">
          <div className="flex items-center justify-between mb-2">
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

          {/* Year plan selector */}
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
              {presets
                .slice()
                .sort((a, b) =>
                  (a.budgetYearStart ?? a.name).localeCompare(b.budgetYearStart ?? b.name),
                )
                .map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectEditingPreset(p)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors',
                    editingPresetId === p.id
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

      {/* ─── Portfolio Composition — inline editable table ─── */}
      {(() => {
        const totalPct = draftTotalPct(draftRows);
        const isOver = totalPct > 100.05;
        const isUnder = totalPct < 99.95 && draftRows.some((r) => r.symbol.trim() && !r.isAddRow);
        const isBalanced = !isOver && !isUnder;
        const changed = previewBudget !== editingPresetBudget;
        const isDirty = isCompositionDirty(draftRows, presetComposition);
        const addRow = draftRows.find((r) => r.isAddRow);
        const canMakeRoom =
          !!addRow?.symbol.trim() &&
          parseFloat(addRow.targetPercentage) > 0 &&
          totalPct > 100;

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
          <div className="bg-card border border-border rounded-sm mb-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-sm font-semibold">
                  Portfolio Composition
                  {selectedPlanPreset ? (
                    <span className="text-muted-foreground font-normal"> · {selectedPlanPreset.name}</span>
                  ) : null}
                </h2>
                <span
                  className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded tabular-nums',
                    isOver ? 'bg-red-100 text-red-700' : isUnder ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
                  )}
                >
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
                    Preview: {usd(editingPresetBudget)} → <span className="font-semibold text-foreground">{usd(previewBudget)}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="px-5 py-2 bg-muted/30 border-b border-border text-xs text-muted-foreground">
              Each budget year has its own stock list. Edit this plan, save, then use Apply on the saved budget to activate it for strategy.
            </div>

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
                    <th className="py-2.5 px-5 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    [1, 2, 3].map((i) => (
                      <tr key={i} className="border-b border-border">
                        <td colSpan={10} className="px-5 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    draftRows.map((row) => {
                      const pct = parseFloat(row.targetPercentage) || 0;
                      const cur = computeFromBudget(editingPresetBudget, pct, coreR, dipR, crashR, dcaW);
                      const pre = computeFromBudget(previewBudget, pct, coreR, dipR, crashR, dcaW);

                      return (
                        <tr
                          key={row.key}
                          className={cn(
                            'border-b border-border hover:bg-muted/20 transition-colors',
                            row.isAddRow && 'bg-blue-50/50 border-dashed',
                          )}
                        >
                          <td className="py-3 px-5">
                            {row.isAddRow ? (
                              <Input
                                placeholder="Add symbol…"
                                value={row.symbol}
                                onChange={(e) => updateDraftRow(row.key, { symbol: e.target.value.toUpperCase() })}
                                className="h-8 w-28 text-sm uppercase font-semibold border-dashed"
                                maxLength={10}
                              />
                            ) : (
                              <p className="font-semibold">{row.symbol}</p>
                            )}
                          </td>
                          <td className="py-3 px-5 text-right">
                            <div className="relative inline-block">
                              <Input
                                value={row.targetPercentage}
                                onChange={(e) => updateDraftRow(row.key, { targetPercentage: e.target.value })}
                                className={cn(
                                  'h-8 w-20 text-right text-sm font-semibold pr-5',
                                  row.isAddRow && 'border-dashed',
                                )}
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                placeholder={row.isAddRow ? '%' : '0'}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                            </div>
                          </td>
                          <td className="py-3 px-5 text-right tabular-nums">
                            {pct > 0 ? (
                              changed ? (
                                <>
                                  <span className="text-muted-foreground line-through text-xs">{usd(cur.alloc)}</span>
                                  <span className="block font-semibold">{usd(pre.alloc)}</span>
                                </>
                              ) : (
                                usd(cur.alloc)
                              )
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-5 text-right tabular-nums">{pct > 0 ? usd2(cur.weeklyDCA) : '—'}</td>
                          <DerivedCell curVal={cur.dip10} preVal={pre.dip10} />
                          <DerivedCell curVal={cur.dip20} preVal={pre.dip20} />
                          <DerivedCell curVal={cur.crash30} preVal={pre.crash30} />
                          <td className="py-3 px-5 text-right">
                            <Input
                              value={row.fiftyTwoWeekHigh}
                              onChange={(e) => updateDraftRow(row.key, { fiftyTwoWeekHigh: e.target.value })}
                              className={cn('h-8 w-24 text-right text-sm ml-auto', row.isAddRow && 'border-dashed')}
                              type="number"
                              min={0}
                              step={0.01}
                              placeholder="—"
                            />
                          </td>
                          <td className="py-3 px-5 text-center">
                            <button
                              type="button"
                              onClick={() => updateDraftRow(row.key, { isAggressive: !row.isAggressive })}
                              className={cn(
                                'w-10 h-5 rounded-full transition-colors relative mx-auto block',
                                row.isAggressive ? 'bg-foreground' : 'bg-border',
                              )}
                            >
                              <span
                                className={cn(
                                  'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm',
                                  row.isAggressive ? 'left-5' : 'left-0.5',
                                )}
                              />
                            </button>
                          </td>
                          <td className="py-3 px-5 text-right">
                            {!row.isAddRow && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-red-500 hover:text-red-600"
                                onClick={() => removeDraftRow(row.key)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {!isLoading && draftRows.some((r) => r.symbol.trim()) && (() => {
                    const source = draftRows.filter((r) => r.symbol.trim() && parseFloat(r.targetPercentage) > 0);
                    const totCur = source.reduce(
                      (s, r) => {
                        const c = computeFromBudget(currentBudget, parseFloat(r.targetPercentage), coreR, dipR, crashR, dcaW);
                        return { alloc: s.alloc + c.alloc, dca: s.dca + c.weeklyDCA, d10: s.d10 + c.dip10, d20: s.d20 + c.dip20, c30: s.c30 + c.crash30 };
                      },
                      { alloc: 0, dca: 0, d10: 0, d20: 0, c30: 0 },
                    );
                    const totPre = source.reduce(
                      (s, r) => {
                        const p = computeFromBudget(previewBudget, parseFloat(r.targetPercentage), coreR, dipR, crashR, dcaW);
                        return { alloc: s.alloc + p.alloc, dca: s.dca + p.weeklyDCA, d10: s.d10 + p.dip10, d20: s.d20 + p.dip20, c30: s.c30 + p.crash30 };
                      },
                      { alloc: 0, dca: 0, d10: 0, d20: 0, c30: 0 },
                    );
                    const TotCell = ({ c, p }: { c: number; p: number }) => (
                      <td className="py-3 px-5 text-right tabular-nums">
                        {changed ? (
                          <>
                            <span className="text-muted-foreground line-through text-xs">{usd2(c)}</span>
                            <span className="block">{usd2(p)}</span>
                          </>
                        ) : (
                          usd2(c)
                        )}
                      </td>
                    );
                    return (
                      <tr className="bg-muted/30 border-t-2 border-border font-semibold text-sm">
                        <td className="py-3 px-5 text-xs uppercase tracking-wider text-muted-foreground">Total</td>
                        <td
                          className={cn(
                            'py-3 px-5 text-right tabular-nums',
                            isOver ? 'text-red-600' : isUnder ? 'text-amber-600' : 'text-emerald-600',
                          )}
                        >
                          {totalPct.toFixed(1)}%
                        </td>
                        <td className="py-3 px-5 text-right tabular-nums">
                          {changed ? (
                            <>
                              <span className="text-muted-foreground line-through text-xs">{usd(totCur.alloc)}</span>
                              <span className="block">{usd(totPre.alloc)}</span>
                            </>
                          ) : (
                            usd(totCur.alloc)
                          )}
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

            {!isLoading && (
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-t border-border bg-muted/20 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      isOver ? 'text-red-600' : isUnder ? 'text-amber-600' : 'text-emerald-600',
                    )}
                  >
                    Total: {totalPct.toFixed(1)}%
                  </span>
                  {isOver && <span className="text-xs text-red-600">Over 100% — reduce other rows or use Make room</span>}
                  {isUnder && isDirty && (
                    <span className="text-xs text-amber-600">{(100 - totalPct).toFixed(1)}% still unallocated</span>
                  )}
                  {isBalanced && isDirty && <span className="text-xs text-emerald-600">Ready to save</span>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {!isBalanced && totalPct > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() =>
                        setDraftRows((prev) => {
                          const addRow = prev.find((r) => r.isAddRow);
                          const committed = prev.filter((r) => !r.isAddRow);
                          const toBalance = addRow?.symbol.trim() ? [...committed, addRow] : committed;
                          const balanced = balanceDraftTo100(toBalance);
                          const dataRows = balanced.filter((r) => !r.isAddRow);
                          return [...dataRows, createAddRow()];
                        })
                      }
                    >
                      Balance to 100%
                    </Button>
                  )}
                  {canMakeRoom && addRow && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        const newPct = parseFloat(addRow.targetPercentage);
                        setDraftRows((prev) => {
                          const adjusted = makeRoomForNew(prev, ADD_ROW_KEY, newPct);
                          return adjusted.some((r) => r.isAddRow) ? adjusted : [...adjusted, createAddRow()];
                        });
                      }}
                    >
                      Make room for new stock
                    </Button>
                  )}
                  {isDirty && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetDraftFromPreset}>
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={handleSaveComposition}
                    disabled={isSavingComposition || isOver || !isDirty}
                  >
                    {isSavingComposition ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save Allocations
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── Bottom info cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {/* Bucket Ratios */}
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="label-caps mb-2">Bucket Ratios</p>
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
          <p className="label-caps mb-2">DCA Cadence</p>
          <p className="text-2xl md:text-3xl font-serif font-normal">{dcaW}</p>
          <p className="text-[11px] md:text-sm text-muted-foreground mt-1">weeks/yr</p>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-2 hidden md:block">
            Excel default. Switch to 52 if you prefer calendar weeks.
          </p>
        </div>

        {/* Budget Presets */}
        <div className="col-span-2 md:col-span-1 bg-card border border-border rounded-sm p-4">
          <div className="flex items-center justify-between mb-2">
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
