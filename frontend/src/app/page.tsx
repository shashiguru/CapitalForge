'use client';

import { useEffect, useState } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { useAuth } from '@/contexts/auth-context';
import { analyticsApi, budgetApi, portfolioApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/protected-route';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import type {
  PortfolioAnalytics,
  WeeklyBudget,
  DipOpportunity,
  BudgetPreset,
  AllocationChartData,
  PortfolioTimeseries,
} from '@/lib/types';
import { cn } from '@/lib/utils';

function usd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function usd2(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pctStr(n: number, sign = true) {
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

const DIP_LEVEL_COLORS: Record<string, string> = {
  CRASH: 'bg-red-100 text-red-700 border-red-200',
  CRASH_BUCKET: 'bg-red-100 text-red-700 border-red-200',
  DIP_BUCKET: 'bg-orange-100 text-orange-700 border-orange-200',
  MODERATE_DIP: 'bg-amber-100 text-amber-700 border-amber-200',
  LIGHT_DIP: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

const DIP_LEVEL_SHORT: Record<string, string> = {
  CRASH: 'CRASH',
  CRASH_BUCKET: 'CRASH',
  DIP_BUCKET: 'DIP',
  MODERATE_DIP: 'MODERATE',
  LIGHT_DIP: 'LIGHT',
};

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { selectedPortfolio } = usePortfolio();
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [budget, setBudget] = useState<WeeklyBudget | null>(null);
  const [opportunities, setOpportunities] = useState<DipOpportunity[]>([]);
  const [chartData, setChartData] = useState<AllocationChartData[]>([]);
  const [weeklyTxData, setWeeklyTxData] = useState<PortfolioTimeseries[]>([]);
  const [budgetPresets, setBudgetPresets] = useState<BudgetPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedPortfolio) return;
      setIsLoading(true);
      try {
        const [analyticsData, budgetData, oppsData, chartRes, weeklyRes, presetsData] =
          await Promise.all([
            analyticsApi.getPortfolioAnalytics(selectedPortfolio.id),
            budgetApi.getCurrent(selectedPortfolio.id),
            analyticsApi.getDipOpportunities(selectedPortfolio.id),
            analyticsApi.getAllocationChartData(selectedPortfolio.id),
            analyticsApi.getWeeklyTransactions(selectedPortfolio.id, 12).catch(() => []),
            portfolioApi.getBudgetPresets(selectedPortfolio.id).catch(() => []),
          ]);
        setAnalytics(analyticsData as unknown as PortfolioAnalytics);
        setBudget(budgetData);
        setOpportunities(oppsData as unknown as DipOpportunity[]);
        setChartData(chartRes as unknown as AllocationChartData[]);
        setWeeklyTxData(Array.isArray(weeklyRes) ? weeklyRes : []);
        setBudgetPresets(presetsData);
      } catch {
        // silent
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedPortfolio]);

  const year = selectedPortfolio?.budgetYearStart
    ? new Date(selectedPortfolio.budgetYearStart).getFullYear()
    : new Date().getFullYear();

  const dipsBySymbol = Object.fromEntries(opportunities.map((o) => [o.symbol, o]));
  const weeklyDCATotal = analytics?.holdings?.reduce((s, h) => s + (h.weeklyDCA ?? 0), 0) ?? 0;
  const dcaWeeks = selectedPortfolio?.dcaWeeksPerYear ?? 48;

  if (!selectedPortfolio) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-2">
            <p className="label-caps">No portfolio selected</p>
            <p className="text-2xl font-serif text-foreground">Create or select a portfolio</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* ─── Page Header ─── */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="label-caps mb-1">Portfolio · {year} Fiscal Year</p>
            <h1 className="text-5xl font-serif font-normal text-foreground leading-tight">
              Portfolio Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedPortfolio.name} · CapitalForge Strategy Engine
            </p>
          </div>

          {/* Investor contribution widgets */}
          {budgetPresets.length > 0 && (
            <div className="hidden md:flex items-center gap-6 pt-2">
              {budgetPresets.slice(0, 2).map((preset) => (
                <div key={preset.id} className="text-right">
                  <p className="label-caps">{preset.name}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {usd(preset.totalCapital)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Three stat cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Total Portfolio Value */}
        <div className="bg-card border border-border rounded-sm p-5">
          <p className="label-caps mb-3">Total Portfolio Value</p>
          {isLoading ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-serif font-normal tabular-nums">
                  {usd(analytics?.totalCurrentValue ?? 0)}
                </span>
                <span
                  className={cn(
                    'text-xs font-semibold px-1.5 py-0.5 rounded',
                    (analytics?.totalUnrealizedPnLPercent ?? 0) >= 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  )}
                >
                  {pctStr(analytics?.totalUnrealizedPnLPercent ?? 0)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Unrealized P&L:{' '}
                <span
                  className={cn(
                    'font-medium',
                    (analytics?.totalUnrealizedPnL ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                  )}
                >
                  {(analytics?.totalUnrealizedPnL ?? 0) >= 0 ? '+' : ''}
                  {usd(analytics?.totalUnrealizedPnL ?? 0)}
                </span>
              </p>
            </>
          )}
        </div>

        {/* Capital Deployment */}
        <div className="bg-card border border-border rounded-sm p-5">
          <p className="label-caps mb-3">Capital Deployment</p>
          {isLoading ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <>
              <span className="text-4xl font-serif font-normal tabular-nums">
                {usd(analytics?.totalInvested ?? 0)}
              </span>
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Budget Deployed</span>
                  <span className="font-semibold text-foreground">
                    {analytics?.investedPercent?.toFixed(1) ?? 0}%
                  </span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all"
                    style={{ width: `${Math.min(analytics?.investedPercent ?? 0, 100)}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Weekly DCA Target */}
        <div className="bg-foreground text-background rounded-sm p-5">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-background/60 mb-3">
            Weekly DCA Target
          </p>
          {isLoading ? (
            <Skeleton className="h-10 w-32 bg-background/20" />
          ) : (
            <>
              <span className="text-4xl font-serif font-normal tabular-nums">
                {usd2(weeklyDCATotal)}
              </span>
              <p className="text-xs text-background/60 mt-2 uppercase tracking-wide">
                {dcaWeeks} Weeks · Per Year Pace
              </p>
            </>
          )}
        </div>
      </div>

      {/* ─── Main 2-col layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Holdings Table */}
        <div className="bg-card border border-border rounded-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold">Holdings</h2>
            <span className="label-caps">
              {analytics?.holdings?.length ?? 0} active positions
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['SYMBOL', 'SHARES', 'AVG', 'PRICE', 'VALUE', 'P&L', 'DRIFT'].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        'py-2.5 px-5 label-caps text-left',
                        h !== 'SYMBOL' && 'text-right'
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? [1, 2, 3, 4, 5].map((i) => (
                      <tr key={i} className="border-b border-border">
                        <td colSpan={7} className="px-5 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      </tr>
                    ))
                  : (analytics?.holdings ?? []).map((h) => {
                      const dip = dipsBySymbol[h.symbol];
                      const pnlPos = (h.unrealizedPnL ?? 0) >= 0;
                      const drift = h.driftPercent ?? 0;
                      return (
                        <tr
                          key={h.symbol}
                          className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                        >
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-semibold">{h.symbol}</p>
                                {h.companyName && (
                                  <p className="text-[11px] text-muted-foreground">{h.companyName}</p>
                                )}
                              </div>
                              {dip && (
                                <span
                                  className={cn(
                                    'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                                    DIP_LEVEL_COLORS[dip.dipLevel] ?? 'bg-muted text-muted-foreground border-border'
                                  )}
                                >
                                  {DIP_LEVEL_SHORT[dip.dipLevel] ?? dip.dipLevel}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-5 text-right tabular-nums text-muted-foreground">
                            {(h.sharesOwned ?? 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-5 text-right tabular-nums text-muted-foreground">
                            {h.avgCostBasis ? usd2(h.avgCostBasis) : '—'}
                          </td>
                          <td className="py-3 px-5 text-right tabular-nums font-medium">
                            {h.currentPrice ? usd2(h.currentPrice) : '—'}
                          </td>
                          <td className="py-3 px-5 text-right tabular-nums font-semibold">
                            {h.currentValue ? usd(h.currentValue) : '—'}
                          </td>
                          <td
                            className={cn(
                              'py-3 px-5 text-right tabular-nums font-semibold',
                              pnlPos ? 'text-emerald-600' : 'text-red-600'
                            )}
                          >
                            {h.unrealizedPnL != null
                              ? `${pnlPos ? '+' : ''}${pctStr(h.unrealizedPnLPercent ?? 0, false)}`
                              : '—'}
                          </td>
                          <td
                            className={cn(
                              'py-3 px-5 text-right tabular-nums text-sm',
                              Math.abs(drift) > 5
                                ? drift > 0
                                  ? 'text-emerald-600'
                                  : 'text-red-600'
                                : 'text-muted-foreground'
                            )}
                          >
                            {drift >= 0 ? '+' : ''}
                            {drift.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dip Opportunities */}
        <div className="bg-card border border-border rounded-sm">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold">Dip Opportunities</h2>
          </div>
          <div className="p-4 space-y-3">
            {isLoading
              ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)
              : opportunities.length === 0
              ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No active dip opportunities
                  </p>
                )
              : opportunities.map((opp) => {
                  const holding = analytics?.holdings?.find((h) => h.symbol === opp.symbol);
                  const weeklyDCA = holding?.weeklyDCA ?? 0;
                  const dipColor = DIP_LEVEL_COLORS[opp.dipLevel] ?? 'bg-muted text-muted-foreground border-border';
                  const dipShort = DIP_LEVEL_SHORT[opp.dipLevel] ?? opp.dipLevel;
                  return (
                    <div key={opp.symbol} className="border border-border rounded-sm p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{opp.symbol}</span>
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', dipColor)}>
                          {dipShort}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        -{opp.dipPercent.toFixed(1)}% from {usd2(opp.fiftyTwoWeekHigh)}
                      </p>
                      <p className="text-lg font-serif font-normal tabular-nums">
                        {usd2(opp.currentPrice)}
                        <span className="text-xs text-muted-foreground font-sans ml-2">
                          {weeklyDCA > 0
                            ? `${(opp.currentPrice > 0 ? Math.floor(weeklyDCA / opp.currentPrice) : 0)} sh · ${Math.round(opp.bucketAvailable > 0 ? opp.bucketAvailable / (weeklyDCA || 1) : 0)}× DCA`
                            : ''}
                        </span>
                      </p>
                    </div>
                  );
                })}
          </div>
        </div>
      </div>

      {/* ─── Charts ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Allocation pie */}
        <div className="bg-card border border-border rounded-sm p-5">
          <p className="label-caps mb-4">Allocation Breakdown</p>
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="symbol"
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => usd(Number(v ?? 0))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Weekly purchases bar */}
        <div className="bg-card border border-border rounded-sm p-5">
          <p className="label-caps mb-4">Weekly Purchases (12 weeks)</p>
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : weeklyTxData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No transactions yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyTxData} margin={{ top: 4, right: 4, left: 0, bottom: 20 }}>
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => usd(Number(v ?? 0))} />
                <Legend />
                {Object.keys(weeklyTxData[0] || {})
                  .filter((k) => k !== 'week')
                  .map((sym, i) => (
                    <Bar
                      key={sym}
                      dataKey={sym}
                      stackId="1"
                      fill={['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'][i % 6]}
                      name={sym}
                    />
                  ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </AppShell>
  );
}
