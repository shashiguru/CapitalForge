'use client';

import { useEffect, useState } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { portfolioApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Loader2, Trash2, Check, Calendar, DollarSign, Pencil } from 'lucide-react';
import type { BudgetPreset } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function getDefaultYearDates() {
  const y = new Date().getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BudgetPage() {
  const { selectedPortfolio, fetchPortfolios, refreshPortfolio, updatePortfolio } = usePortfolio();
  const [presets, setPresets] = useState<BudgetPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isApplying, setIsApplying] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdatingActive, setIsUpdatingActive] = useState(false);
  const [editingPreset, setEditingPreset] = useState<BudgetPreset | null>(null);
  const [isUpdatingPreset, setIsUpdatingPreset] = useState(false);
  const [addBudgetName, setAddBudgetName] = useState('');
  const [addBudgetAmount, setAddBudgetAmount] = useState('');
  const [addBudgetStart, setAddBudgetStart] = useState('');
  const [addBudgetEnd, setAddBudgetEnd] = useState('');
  const [activeBudgetInput, setActiveBudgetInput] = useState('');
  const [activeYearStartInput, setActiveYearStartInput] = useState('');
  const [activeYearEndInput, setActiveYearEndInput] = useState('');
  const [activeStrategyRefInput, setActiveStrategyRefInput] = useState('');
  const [isActiveEditModalOpen, setIsActiveEditModalOpen] = useState(false);
  const [editPresetName, setEditPresetName] = useState('');
  const [editPresetAmount, setEditPresetAmount] = useState('');
  const [editPresetStart, setEditPresetStart] = useState('');
  const [editPresetEnd, setEditPresetEnd] = useState('');

  const fetchData = async () => {
    if (!selectedPortfolio) return;
    setIsLoading(true);
    try {
      const data = await portfolioApi.getBudgetPresets(selectedPortfolio.id);
      setPresets(data);
    } catch {
      toast.error('Failed to load budgets');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPortfolio?.id]);

  useEffect(() => {
    if (selectedPortfolio) {
      setActiveBudgetInput(selectedPortfolio.totalCapital.toString());
      setActiveStrategyRefInput(
        selectedPortfolio.strategyReferenceBudget != null
          ? selectedPortfolio.strategyReferenceBudget.toString()
          : selectedPortfolio.totalCapital.toString()
      );
      const defaults = getDefaultYearDates();
      setActiveYearStartInput(selectedPortfolio.budgetYearStart ?? defaults.start);
      setActiveYearEndInput(selectedPortfolio.budgetYearEnd ?? defaults.end);
    }
  }, [selectedPortfolio]);

  const openAddModal = () => {
    const defaults = getDefaultYearDates();
    setAddBudgetName('');
    setAddBudgetAmount('');
    setAddBudgetStart(defaults.start);
    setAddBudgetEnd(defaults.end);
    setIsAddModalOpen(true);
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
    setIsAdding(true);
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
      setIsAddModalOpen(false);
      toast.success('Budget created. Use "Apply" to switch to it.');
    } catch {
      toast.error('Failed to add budget');
    } finally {
      setIsAdding(false);
    }
  };

  const handleApply = async (presetId: string) => {
    if (!selectedPortfolio) return;
    setIsApplying(presetId);
    try {
      const updated = await portfolioApi.applyBudgetPreset(selectedPortfolio.id, presetId);
      updatePortfolio(updated);
      await fetchPortfolios();
      await fetchData();
      toast.success('Budget applied');
    } catch {
      toast.error('Failed to apply budget');
    } finally {
      setIsApplying(null);
    }
  };

  const handleUpdateActiveBudget = async () => {
    if (!selectedPortfolio) return;
    const totalCapital = parseFloat(activeBudgetInput);
    if (isNaN(totalCapital) || totalCapital < 0) {
      toast.error('Please enter a valid budget');
      return;
    }
    if (!activeYearStartInput || !activeYearEndInput) {
      toast.error('Please set start and end dates');
      return;
    }
    const start = new Date(activeYearStartInput);
    const end = new Date(activeYearEndInput);
    if (start >= end) {
      toast.error('Start date must be before end date');
      return;
    }
    const strategyRef = activeStrategyRefInput.trim() ? parseFloat(activeStrategyRefInput) : totalCapital;
    if (isNaN(strategyRef) || strategyRef < 0) {
      toast.error('Please enter a valid strategy reference budget');
      return;
    }
    setIsUpdatingActive(true);
    try {
      const updated = await portfolioApi.update(selectedPortfolio.id, {
        totalCapital,
        strategyReferenceBudget: strategyRef,
        budgetYearStart: activeYearStartInput,
        budgetYearEnd: activeYearEndInput,
      });
      updatePortfolio(updated);
      await fetchPortfolios();
      await fetchData();
      toast.success('Budget updated');
      setIsActiveEditModalOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to update budget';
      toast.error(msg);
    } finally {
      setIsUpdatingActive(false);
    }
  };

  const openEditPresetModal = (preset: BudgetPreset) => {
    setEditingPreset(preset);
    setEditPresetName(preset.name);
    setEditPresetAmount(preset.totalCapital.toString());
    setEditPresetStart((preset.budgetYearStart ?? '').slice(0, 10));
    setEditPresetEnd((preset.budgetYearEnd ?? '').slice(0, 10));
  };

  const handleUpdatePreset = async () => {
    if (!selectedPortfolio || !editingPreset) return;
    const totalCapital = parseFloat(editPresetAmount);
    if (isNaN(totalCapital) || totalCapital < 0) {
      toast.error('Please enter a valid budget amount');
      return;
    }
    if (!editPresetStart || !editPresetEnd) {
      toast.error('Please set start and end dates');
      return;
    }
    const start = new Date(editPresetStart);
    const end = new Date(editPresetEnd);
    if (start >= end) {
      toast.error('Start date must be before end date');
      return;
    }
    setIsUpdatingPreset(true);
    try {
      await portfolioApi.updateBudgetPreset(selectedPortfolio.id, editingPreset.id, {
        name: editPresetName.trim(),
        totalCapital,
        budgetYearStart: editPresetStart,
        budgetYearEnd: editPresetEnd,
      });
      await fetchData();
      setEditingPreset(null);
      toast.success('Budget updated');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to update budget';
      toast.error(msg);
    } finally {
      setIsUpdatingPreset(false);
    }
  };

  const handleDelete = async (presetId: string) => {
    if (!selectedPortfolio) return;
    setIsDeleting(presetId);
    try {
      await portfolioApi.deleteBudgetPreset(selectedPortfolio.id, presetId);
      await fetchData();
      toast.success('Budget deleted');
    } catch {
      toast.error('Failed to delete budget');
    } finally {
      setIsDeleting(null);
    }
  };

  const matchesPortfolio = (preset: BudgetPreset) => {
    if (!selectedPortfolio) return false;
    return (
      Number(selectedPortfolio.totalCapital) === Number(preset.totalCapital) &&
      (selectedPortfolio.budgetYearStart ?? '').slice(0, 10) === (preset.budgetYearStart ?? '').slice(0, 10) &&
      (selectedPortfolio.budgetYearEnd ?? '').slice(0, 10) === (preset.budgetYearEnd ?? '').slice(0, 10)
    );
  };

  const sortedPresets = [...presets].sort((a, b) => {
    const startA = a.budgetYearStart ? new Date(a.budgetYearStart).getTime() : 0;
    const startB = b.budgetYearStart ? new Date(b.budgetYearStart).getTime() : 0;
    return startB - startA;
  });

  // Only one preset can show "Active" - use first match to avoid duplicate badges
  const activePresetId = sortedPresets.find((p) => matchesPortfolio(p))?.id ?? null;

  if (!selectedPortfolio) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">
          Select a portfolio to view budgets
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Budget</h1>
            <p className="text-muted-foreground">Year-wise budgets with start and end dates</p>
          </div>
          <Button onClick={openAddModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add Budget
          </Button>
        </div>

        {/* Current budget summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Active Budget</CardTitle>
              <CardDescription>Currently applied to this portfolio</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveBudgetInput(selectedPortfolio.totalCapital.toString());
                setActiveStrategyRefInput(
                  selectedPortfolio.strategyReferenceBudget != null
                    ? selectedPortfolio.strategyReferenceBudget.toString()
                    : selectedPortfolio.totalCapital.toString()
                );
                const defaults = getDefaultYearDates();
                setActiveYearStartInput(selectedPortfolio.budgetYearStart ?? defaults.start);
                setActiveYearEndInput(selectedPortfolio.budgetYearEnd ?? defaults.end);
                setIsActiveEditModalOpen(true);
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-12 w-64" />
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Budget:</span>
                  <span className="text-2xl font-bold">
                    ${selectedPortfolio.totalCapital.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {formatDate(selectedPortfolio.budgetYearStart)}
                    {' – '}
                    {formatDate(selectedPortfolio.budgetYearEnd)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget list */}
        <Card>
          <CardHeader>
            <CardTitle>Year-wise Budgets</CardTitle>
            <CardDescription>All saved budget presets. Apply one to switch.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : sortedPresets.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                No budgets yet. Add one to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Total Budget</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="w-[180px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPresets.map((preset) => {
                    const isActive = preset.id === activePresetId;
                    return (
                      <TableRow key={preset.id} className={cn(isActive && 'bg-muted/50')}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{preset.name}</span>
                            {isActive && (
                              <Badge variant="secondary" className="text-xs">
                                Active
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          ${preset.totalCapital.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(preset.budgetYearStart)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(preset.budgetYearEnd)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => openEditPresetModal(preset)}
                              disabled={!!isUpdatingPreset}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            {!isActive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => handleApply(preset.id)}
                                disabled={!!isApplying}
                              >
                                {isApplying === preset.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Check className="h-3 w-3 mr-1" />
                                    Apply
                                  </>
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-destructive hover:text-destructive"
                              onClick={() => handleDelete(preset.id)}
                              disabled={!!isDeleting}
                            >
                              {isDeleting === preset.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Active Budget Dialog */}
        <Dialog open={isActiveEditModalOpen} onOpenChange={setIsActiveEditModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Active Budget</DialogTitle>
              <DialogDescription>
                Change the total budget and period for this portfolio.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="active-budget">Total Budget ($)</Label>
                <Input
                  id="active-budget"
                  type="number"
                  min={0}
                  step={100}
                  value={activeBudgetInput}
                  onChange={(e) => setActiveBudgetInput(e.target.value)}
                  placeholder="20000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="active-strategy-ref">Strategy Reference ($)</Label>
                <Input
                  id="active-strategy-ref"
                  type="number"
                  min={0}
                  step={100}
                  value={activeStrategyRefInput}
                  onChange={(e) => setActiveStrategyRefInput(e.target.value)}
                  placeholder="e.g. 23639"
                />
                <p className="text-xs text-muted-foreground">
                  Budget your strategy was designed for. Amounts scale by current budget ÷ this value.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="active-start">Start</Label>
                <Input
                  id="active-start"
                  type="date"
                  value={activeYearStartInput}
                  onChange={(e) => setActiveYearStartInput(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="active-end">End</Label>
                <Input
                  id="active-end"
                  type="date"
                  value={activeYearEndInput}
                  onChange={(e) => setActiveYearEndInput(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsActiveEditModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateActiveBudget} disabled={isUpdatingActive}>
                {isUpdatingActive ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Preset Dialog */}
        <Dialog open={!!editingPreset} onOpenChange={(open) => !open && setEditingPreset(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Budget</DialogTitle>
              <DialogDescription>
                Update the name, total budget, and period for this preset.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-preset-name">Name</Label>
                <Input
                  id="edit-preset-name"
                  value={editPresetName}
                  onChange={(e) => setEditPresetName(e.target.value)}
                  placeholder="e.g. 2026 Budget"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-preset-amount">Total Budget ($)</Label>
                <Input
                  id="edit-preset-amount"
                  type="number"
                  min={0}
                  step={100}
                  value={editPresetAmount}
                  onChange={(e) => setEditPresetAmount(e.target.value)}
                  placeholder="20000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-preset-start">Start</Label>
                <Input
                  id="edit-preset-start"
                  type="date"
                  value={editPresetStart}
                  onChange={(e) => setEditPresetStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-preset-end">End</Label>
                <Input
                  id="edit-preset-end"
                  type="date"
                  value={editPresetEnd}
                  onChange={(e) => setEditPresetEnd(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPreset(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePreset} disabled={isUpdatingPreset}>
                {isUpdatingPreset ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Budget Dialog */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Budget</DialogTitle>
              <DialogDescription>
                Create a new year-wise budget with name, amount, and period.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-budget-name">Name</Label>
                <Input
                  id="add-budget-name"
                  placeholder="e.g. 2026 Budget"
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
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddBudget} disabled={isAdding}>
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Budget
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
