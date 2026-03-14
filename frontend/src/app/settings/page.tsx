'use client';

import { useEffect, useState } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { portfolioApi, allocationApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { selectedPortfolio, fetchPortfolios, refreshPortfolio } = usePortfolio();
  const [yearlyBudget, setYearlyBudget] = useState('');
  const [strategyReferenceBudget, setStrategyReferenceBudget] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedPortfolio) {
      setYearlyBudget(selectedPortfolio.totalCapital.toString());
      setStrategyReferenceBudget(
        selectedPortfolio.strategyReferenceBudget != null
          ? selectedPortfolio.strategyReferenceBudget.toString()
          : selectedPortfolio.totalCapital.toString()
      );
      const y = new Date().getFullYear();
      setYearStart(selectedPortfolio.budgetYearStart ?? `${y}-01-01`);
      setYearEnd(selectedPortfolio.budgetYearEnd ?? `${y}-12-31`);
    }
  }, [selectedPortfolio]);

  const handleSave = async () => {
    if (!selectedPortfolio) return;

    const totalCapital = parseFloat(yearlyBudget);
    const refBudgetVal = strategyReferenceBudget.trim() === '' ? totalCapital : parseFloat(strategyReferenceBudget);

    if (isNaN(totalCapital) || totalCapital < 0) {
      toast.error('Please enter a valid yearly budget');
      return;
    }
    if (isNaN(refBudgetVal) || refBudgetVal < 0) {
      toast.error('Please enter a valid strategy reference budget');
      return;
    }

    const startDate = yearStart.trim() || undefined;
    const endDate = yearEnd.trim() || undefined;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        toast.error('Start date must be before end date');
        return;
      }
    }

    setIsSaving(true);
    try {
      await portfolioApi.update(selectedPortfolio.id, {
        totalCapital,
        strategyReferenceBudget: refBudgetVal,
        budgetYearStart: startDate,
        budgetYearEnd: endDate,
      });
      await allocationApi.recalculateBuckets(selectedPortfolio.id);
      await fetchPortfolios();
      await refreshPortfolio();
      toast.success('Budget saved. Allocations and DCA amounts recalculated.');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedPortfolio) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <Card className="w-96 text-center">
            <CardHeader>
              <CardTitle>No Portfolio Selected</CardTitle>
              <CardDescription>Select a portfolio to manage settings.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 w-full max-w-2xl">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your portfolio and strategy budget</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Yearly Budget</CardTitle>
            <CardDescription>
              Your yearly investment budget. Allocations and DCA amounts are recalculated when you save. Strategy buy amounts scale when this differs from the reference budget.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="yearlyBudget">Yearly Budget ($)</Label>
              <Input
                id="yearlyBudget"
                type="number"
                min={0}
                step={100}
                value={yearlyBudget}
                onChange={(e) => setYearlyBudget(e.target.value)}
                placeholder="e.g. 20000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="strategyRefBudget">Strategy Reference Budget ($)</Label>
              <Input
                id="strategyRefBudget"
                type="number"
                min={0}
                step={100}
                value={strategyReferenceBudget}
                onChange={(e) => setStrategyReferenceBudget(e.target.value)}
                placeholder="e.g. 23639"
              />
              <p className="text-xs text-muted-foreground">
                The yearly budget your strategy was designed for (e.g. last year&apos;s budget). Leave same as yearly budget for no scaling.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="yearStart">Budget Period Start</Label>
                <Input
                  id="yearStart"
                  type="date"
                  value={yearStart}
                  onChange={(e) => setYearStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearEnd">Budget Period End</Label>
                <Input
                  id="yearEnd"
                  type="date"
                  value={yearEnd}
                  onChange={(e) => setYearEnd(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Start and end of your budget period (e.g. Jan 1 – Dec 31 for calendar year).
            </p>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
