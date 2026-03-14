'use client';

import { useEffect, useState } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { analyticsApi, budgetApi, portfolioApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Target, AlertTriangle, DollarSign, Calendar } from 'lucide-react';
import type { PortfolioAnalytics, WeeklyBudget, DipOpportunity, BucketUsage, BudgetPreset } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  isLoading,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {(subtitle || trendValue) && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {trend && (
                  <span className={cn(
                    'flex items-center',
                    trend === 'up' && 'text-green-500',
                    trend === 'down' && 'text-red-500'
                  )}>
                    {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {trendValue}
                  </span>
                )}
                {subtitle && <span>{subtitle}</span>}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BucketCard({ bucket, isLoading }: { bucket: BucketUsage; isLoading: boolean }) {
  const utilization = Number(bucket?.utilizationPercent) || 0;
  const getColor = (u: number) => {
    if (u < 50) return 'bg-green-500';
    if (u < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{bucket?.bucket ?? '—'}</span>
        <span className="text-muted-foreground">
          ${(bucket?.used ?? 0).toLocaleString()} / ${(bucket?.allocated ?? 0).toLocaleString()}
        </span>
      </div>
      {isLoading ? (
        <Skeleton className="h-2 w-full" />
      ) : (
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all', getColor(utilization))}
            style={{ width: `${Math.min(utilization, 100)}%` }}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {utilization.toFixed(1)}% used | ${(bucket?.remaining ?? 0).toLocaleString()} remaining
      </p>
    </div>
  );
}

function DipOpportunityCard({ opportunity }: { opportunity: DipOpportunity }) {
  const getDipColor = (dipLevel: string) => {
    switch (dipLevel) {
      case 'CRASH':
        return 'text-red-500 bg-red-50 dark:bg-red-950';
      case 'SIGNIFICANT':
        return 'text-orange-500 bg-orange-50 dark:bg-orange-950';
      case 'MODERATE':
        return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-950';
      default:
        return 'text-blue-500 bg-blue-50 dark:bg-blue-950';
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{opportunity.symbol}</span>
          <Badge variant="outline" className={cn('text-xs', getDipColor(opportunity.dipLevel ?? ''))}>
            {opportunity.dipLevel ?? '—'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          ${(opportunity.currentPrice ?? 0).toFixed(2)} | 52w High: ${(opportunity.fiftyTwoWeekHigh ?? 0).toFixed(2)}
        </p>
      </div>
      <div className="text-right">
        <p className={cn('text-lg font-bold', 'text-red-500')}>
          -{(opportunity.dipPercent ?? 0).toFixed(1)}%
        </p>
        <p className="text-xs text-muted-foreground">{opportunity.recommendedAction ?? ''}</p>
      </div>
    </div>
  );
}

function HoldingsTable({ holdings, isLoading }: { holdings: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {holdings.slice(0, 5).map((holding) => (
        <div
          key={holding.symbol}
          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          <div>
            <p className="font-medium">{holding.symbol}</p>
            <p className="text-xs text-muted-foreground">
              {(holding.sharesOwned ?? 0).toFixed(2)} shares @ ${(holding.avgCostBasis ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-medium">${(holding.currentValue ?? 0).toLocaleString()}</p>
            <p className={cn(
              'text-xs',
              (holding.unrealizedPnL ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'
            )}>
              {(holding.unrealizedPnL ?? 0) >= 0 ? '+' : ''}${(holding.unrealizedPnL ?? 0).toFixed(2)} ({(holding.unrealizedPnLPercent ?? 0).toFixed(1)}%)
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { selectedPortfolio } = usePortfolio();
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [budget, setBudget] = useState<WeeklyBudget | null>(null);
  const [buckets, setBuckets] = useState<BucketUsage[]>([]);
  const [opportunities, setOpportunities] = useState<DipOpportunity[]>([]);
  const [budgetPresets, setBudgetPresets] = useState<BudgetPreset[]>([]);
  const [budgetViewMode, setBudgetViewMode] = useState<'total' | 'yearly'>('yearly');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedPortfolio) return;

      setIsLoading(true);
      try {
        const [analyticsData, budgetData, bucketsData, opportunitiesData, presetsData] = await Promise.all([
          analyticsApi.getPortfolioAnalytics(selectedPortfolio.id),
          budgetApi.getCurrent(selectedPortfolio.id),
          analyticsApi.getBucketUsage(selectedPortfolio.id),
          analyticsApi.getDipOpportunities(selectedPortfolio.id),
          portfolioApi.getBudgetPresets(selectedPortfolio.id).catch(() => []),
        ]);

        setAnalytics(analyticsData);
        setBudget(budgetData);
        setBuckets(bucketsData);
        setOpportunities(opportunitiesData);
        setBudgetPresets(presetsData);
        // Default selected year when presets load
        if (presetsData.length > 0) {
          const currentYear = new Date().getFullYear().toString();
          const hasCurrentYear = presetsData.some((p) =>
            p.budgetYearStart ? p.budgetYearStart.startsWith(currentYear) : false
          );
          setSelectedYear(hasCurrentYear ? currentYear : (presetsData[0].budgetYearStart?.slice(0, 4) ?? ''));
        } else {
          setSelectedYear('');
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedPortfolio]);

  if (!selectedPortfolio) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <Card className="w-96 text-center">
            <CardHeader>
              <CardTitle>No Portfolio Selected</CardTitle>
              <CardDescription>
                Create a portfolio or select one from the header to get started.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Overview of {selectedPortfolio.name}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Portfolio Value"
            value={`$${analytics?.totalCurrentValue?.toLocaleString() ?? '0'}`}
            icon={Wallet}
            trend={analytics?.totalUnrealizedPnL != null && analytics.totalUnrealizedPnL >= 0 ? 'up' : 'down'}
            trendValue={`${analytics?.totalUnrealizedPnLPercent?.toFixed(1) ?? '0'}%`}
            isLoading={isLoading}
          />
          <StatCard
            title="Total Invested"
            value={`$${analytics?.totalInvested?.toLocaleString() ?? '0'}`}
            subtitle={`${analytics?.investedPercent?.toFixed(1) ?? '0'}% deployed`}
            icon={DollarSign}
            isLoading={isLoading}
          />
          <StatCard
            title="Weekly Budget"
            value={budget ? `$${budget.plannedAmount?.toLocaleString() ?? '0'}` : '$0'}
            subtitle={
              budget
                ? `${budget.utilizationPercent?.toFixed(1) ?? '0'}% used · $${budget.remainingAmount?.toLocaleString() ?? '0'} left`
                : 'No budget set'
            }
            icon={PiggyBank}
            isLoading={isLoading}
          />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Budget</CardTitle>
              <div className="flex items-center gap-1">
                {!isLoading && budgetPresets.length > 0 && (
                  <Select
                    value={
                      budgetViewMode === 'total'
                        ? 'total'
                        : selectedYear ||
                          budgetPresets
                            .map((p) => (p.budgetYearStart ? p.budgetYearStart.slice(0, 4) : null))
                            .filter((y): y is string => !!y)[0] ||
                          'total'
                    }
                    onValueChange={(v) => {
                      if (v === 'total') {
                        setBudgetViewMode('total');
                      } else {
                        setBudgetViewMode('yearly');
                        setSelectedYear(v);
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 w-[90px] border-0 bg-transparent shadow-none focus:ring-0 text-xs font-medium text-muted-foreground hover:text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Total</SelectItem>
                      {budgetPresets
                        .map((p) => (p.budgetYearStart ? p.budgetYearStart.slice(0, 4) : null))
                        .filter((y): y is string => !!y)
                        .filter((y, i, arr) => arr.indexOf(y) === i)
                        .sort()
                        .map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {budgetPresets.length > 0 && budgetViewMode === 'total'
                      ? `$${budgetPresets.reduce((sum, p) => sum + (p.totalCapital ?? 0), 0).toLocaleString()}`
                      : budgetPresets.length > 0 && budgetViewMode === 'yearly'
                        ? (() => {
                            const yearToShow = selectedYear || budgetPresets
                              .map((p) => (p.budgetYearStart ? p.budgetYearStart.slice(0, 4) : null))
                              .filter((y): y is string => !!y)[0] || '';
                            const preset = budgetPresets.find((p) =>
                              p.budgetYearStart?.startsWith(yearToShow)
                            );
                            return `$${preset ? preset.totalCapital.toLocaleString() : '0'}`;
                          })()
                        : budget
                          ? `$${((budget.plannedAmount ?? 0) * 48).toLocaleString()}`
                          : selectedPortfolio?.strategyReferenceBudget != null
                            ? `$${selectedPortfolio.strategyReferenceBudget.toLocaleString()}`
                            : selectedPortfolio?.totalCapital != null
                              ? `$${selectedPortfolio.totalCapital.toLocaleString()}`
                              : '$0'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {budgetPresets.length > 0 && budgetViewMode === 'total'
                      ? `Sum of ${budgetPresets.length} year${budgetPresets.length === 1 ? '' : 's'}`
                      : budgetPresets.length > 0 && budgetViewMode === 'yearly'
                        ? `${selectedYear || budgetPresets[0]?.budgetYearStart?.slice(0, 4) || ''} budget`
                        : budget
                          ? '48 weeks DCA'
                          : 'From portfolio'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <StatCard
            title="Unrealized P&L"
            value={`$${analytics?.totalUnrealizedPnL?.toLocaleString() ?? '0'}`}
            icon={Target}
            trend={analytics?.totalUnrealizedPnL != null && analytics.totalUnrealizedPnL >= 0 ? 'up' : 'down'}
            trendValue={`${analytics?.totalUnrealizedPnLPercent?.toFixed(1) ?? '0'}%`}
            isLoading={isLoading}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Holdings */}
          <Card>
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
              <CardDescription>Your current stock positions</CardDescription>
            </CardHeader>
            <CardContent>
              <HoldingsTable holdings={analytics?.holdings || []} isLoading={isLoading} />
            </CardContent>
          </Card>

          {/* Bucket Usage */}
          <Card>
            <CardHeader>
              <CardTitle>Bucket Allocation</CardTitle>
              <CardDescription>Capital deployment by strategy bucket</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {buckets.map((bucket) => (
                <BucketCard key={bucket.bucket} bucket={bucket} isLoading={isLoading} />
              ))}
            </CardContent>
          </Card>

          {/* Yearly Budget */}
          <Card>
            <CardHeader>
              <CardTitle>Yearly Budget</CardTitle>
              <CardDescription>Budget amount and period</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Budget amount</p>
                    <p className="text-2xl font-bold">
                      ${(selectedPortfolio?.totalCapital ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Start</p>
                      <p className="text-sm font-medium">
                        {selectedPortfolio?.budgetYearStart
                          ? new Date(selectedPortfolio.budgetYearStart).toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">End</p>
                      <p className="text-sm font-medium">
                        {selectedPortfolio?.budgetYearEnd
                          ? new Date(selectedPortfolio.budgetYearEnd).toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dip Opportunities */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Dip Opportunities
                  </CardTitle>
                  <CardDescription>Stocks trading below their 52-week high</CardDescription>
                </div>
                <Badge variant="outline">{opportunities.length} opportunities</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : opportunities.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {opportunities.slice(0, 6).map((opportunity) => (
                    <DipOpportunityCard key={opportunity.symbol} opportunity={opportunity} />
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No significant dip opportunities at the moment
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
