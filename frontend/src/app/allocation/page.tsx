'use client';

import { useEffect, useState } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { allocationApi, portfolioApi } from '@/lib/api';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Edit, RefreshCw, Loader2, Calendar, Pencil } from 'lucide-react';
import type { Allocation, AllocationSummary, BudgetPreset } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function getDefaultYearDates() {
  const y = new Date().getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

export default function AllocationPage() {
  const { selectedPortfolio, fetchPortfolios, refreshPortfolio, updatePortfolio } = usePortfolio();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [summary, setSummary] = useState<AllocationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);

  // Budget state
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

  // Form state
  const [symbol, setSymbol] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [targetPercentage, setTargetPercentage] = useState('');

  const fetchData = async () => {
    if (!selectedPortfolio) return;

    setIsLoading(true);
    try {
      const [allocationsData, summaryData, presetsData] = await Promise.all([
        allocationApi.getAll(selectedPortfolio.id),
        allocationApi.getSummary(selectedPortfolio.id),
        portfolioApi.getBudgetPresets(selectedPortfolio.id).catch(() => []),
      ]);
      setAllocations(allocationsData);
      setSummary(summaryData);
      setBudgetPresets(presetsData);
    } catch (error) {
      toast.error('Failed to fetch allocations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPortfolio]);

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

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const recalcAndRefresh = async () => {
    if (!selectedPortfolio) return;
    try {
      await allocationApi.recalculateBuckets(selectedPortfolio.id);
      await fetchData();
    } catch {
      toast.error('Failed to recalculate allocations');
    }
  };

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
      await recalcAndRefresh();
      toast.success('Budget saved. Allocations recalculated.');
      setIsBudgetModalOpen(false);
    } catch {
      toast.error('Failed to save');
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleApplyPreset = async (presetId: string) => {
    if (!selectedPortfolio) return;
    setIsApplyingPreset(true);
    try {
      const updated = await portfolioApi.applyBudgetPreset(selectedPortfolio.id, presetId);
      updatePortfolio(updated);
      await fetchPortfolios();
      await recalcAndRefresh();
      toast.success('Budget applied. Allocations recalculated.');
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

  const resetForm = () => {
    setSymbol('');
    setCompanyName('');
    setTargetPercentage('');
    setEditingAllocation(null);
  };

  const handleOpenDialog = (allocation?: Allocation) => {
    if (allocation) {
      setEditingAllocation(allocation);
      setSymbol(allocation.symbol);
      setCompanyName(allocation.companyName || '');
      setTargetPercentage(allocation.targetPercentage.toString());
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortfolio) return;

    setIsSubmitting(true);
    try {
      if (editingAllocation) {
        await allocationApi.update(editingAllocation.id, {
          companyName: companyName || undefined,
          targetPercentage: parseFloat(targetPercentage),
        });
        toast.success('Allocation updated');
      } else {
        await allocationApi.create(selectedPortfolio.id, {
          symbol: symbol.toUpperCase(),
          companyName: companyName || undefined,
          targetPercentage: parseFloat(targetPercentage),
        });
        toast.success('Allocation created');
      }
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save allocation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this allocation?')) return;

    try {
      await allocationApi.delete(id);
      toast.success('Allocation deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete allocation');
    }
  };

  const handleRecalculate = async () => {
    if (!selectedPortfolio) return;

    try {
      await allocationApi.recalculateBuckets(selectedPortfolio.id);
      toast.success('Buckets recalculated');
      fetchData();
    } catch (error) {
      toast.error('Failed to recalculate buckets');
    }
  };

  if (!selectedPortfolio) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <Card className="w-96 text-center">
            <CardHeader>
              <CardTitle>No Portfolio Selected</CardTitle>
              <CardDescription>Select a portfolio to manage allocations.</CardDescription>
            </CardHeader>
          </Card>
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
            <h1 className="text-3xl font-bold">Allocation</h1>
            <p className="text-muted-foreground">Manage your portfolio allocation targets</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRecalculate}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Recalculate Buckets
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Allocation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{editingAllocation ? 'Edit Allocation' : 'Add Allocation'}</DialogTitle>
                    <DialogDescription>
                      {editingAllocation
                        ? 'Update the allocation target percentage.'
                        : 'Add a new stock to your portfolio allocation.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="symbol">Symbol</Label>
                      <Input
                        id="symbol"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                        placeholder="AAPL"
                        disabled={!!editingAllocation}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="companyName">Company Name (optional)</Label>
                      <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Apple Inc."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="targetPercentage">Target Percentage (%)</Label>
                      <Input
                        id="targetPercentage"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={targetPercentage}
                        onChange={(e) => setTargetPercentage(e.target.value)}
                        placeholder="10"
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingAllocation ? 'Update' : 'Create'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Budget & Period bar */}
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
              onClick={() => {
                const defaults = getDefaultYearDates();
                setAddBudgetName('');
                setAddBudgetAmount('');
                setAddBudgetStart(defaults.start);
                setAddBudgetEnd(defaults.end);
                setIsAddBudgetModalOpen(true);
              }}
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
                Create a new budget. Allocations will be recalculated based on target percentages.
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
              <Button variant="outline" onClick={() => setIsAddBudgetModalOpen(false)}>Cancel</Button>
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
                Change your budget. Allocations will be recalculated based on target percentages.
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
                  Budget your strategy was designed for. Used for strategy page scaling.
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBudgetModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveBudgetConfig} disabled={isSavingBudget}>
                {isSavingBudget ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Allocated</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{summary?.totalTargetPercentage.toFixed(1)}%</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Allocation USD</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">${summary?.totalAllocationUSD.toLocaleString()}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monthly DCA</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">${summary?.totalMonthlyDCA?.toLocaleString() || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Weekly DCA</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">${summary?.totalWeeklyDCA?.toLocaleString() || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Positions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold">{summary?.allocationsCount}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Allocations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Allocations</CardTitle>
            <CardDescription>Your target allocation for each stock</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : allocations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No allocations yet. Add your first allocation to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Target %</TableHead>
                    <TableHead>Allocation</TableHead>
                    <TableHead>Core DCA</TableHead>
                    <TableHead>Dip (Rem)</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((allocation) => (
                    <TableRow key={allocation.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{allocation.symbol}</p>
                          {allocation.companyName && (
                            <p className="text-xs text-muted-foreground">{allocation.companyName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{allocation.targetPercentage.toFixed(1)}%</Badge>
                      </TableCell>
                      <TableCell>${allocation.allocationUSD.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          ${allocation.weeklyDCA?.toFixed(2) || '0'}
                        </div>
                        <p className="text-xs text-muted-foreground">/week</p>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">${allocation.dipRemainingUSD.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            of ${allocation.dipBucketUSD.toLocaleString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{allocation.sharesOwned.toFixed(2)}</p>
                          {allocation.avgCostBasis > 0 && (
                            <p className="text-xs text-muted-foreground">
                              @ ${allocation.avgCostBasis.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(allocation)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(allocation.id)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
