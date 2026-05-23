'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { analyticsApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Zap } from 'lucide-react';
import type {
  PortfolioAnalytics,
  AllocationChartData,
  BucketUsage,
  DipOpportunity,
  PortfolioTimeseries,
} from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BUCKET_COLORS: Record<string, string> = {
  CORE: '#3B82F6',
  DIP: '#F59E0B',
  CRASH: '#EF4444',
};

function StatCard({
  title,
  value,
  sub,
  positive,
  isLoading,
}: {
  title: string;
  value: string;
  sub?: string;
  positive?: boolean;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <>
            <div
              className={cn(
                'text-2xl font-bold tabular-nums',
                positive === true && 'text-emerald-500',
                positive === false && 'text-red-500'
              )}
            >
              {value}
            </div>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function pct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function usd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AnalyticsPage() {
  const { selectedPortfolio } = usePortfolio();
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [allocationChart, setAllocationChart] = useState<AllocationChartData[]>([]);
  const [bucketUsage, setBucketUsage] = useState<BucketUsage[]>([]);
  const [dips, setDips] = useState<DipOpportunity[]>([]);
  const [timeseries, setTimeseries] = useState<PortfolioTimeseries[]>([]);
  const [timeseriesDays, setTimeseriesDays] = useState('30');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAll = useCallback(
    async (refreshing = false) => {
      if (!selectedPortfolio) return;
      refreshing ? setIsRefreshing(true) : setIsLoading(true);
      try {
        const [analyticsData, chartData, bucketData, dipsData] = await Promise.all([
          analyticsApi.getPortfolioAnalytics(selectedPortfolio.id),
          analyticsApi.getAllocationChartData(selectedPortfolio.id),
          analyticsApi.getBucketUsage(selectedPortfolio.id),
          analyticsApi.getDipOpportunities(selectedPortfolio.id),
        ]);
        setAnalytics(analyticsData as unknown as PortfolioAnalytics);
        setAllocationChart(chartData as unknown as AllocationChartData[]);
        setBucketUsage(bucketData as unknown as BucketUsage[]);
        setDips(dipsData as unknown as DipOpportunity[]);
      } catch {
        toast.error('Failed to load analytics');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedPortfolio]
  );

  const fetchTimeseries = useCallback(async () => {
    if (!selectedPortfolio) return;
    try {
      const data = await analyticsApi.getPortfolioTimeseries(
        selectedPortfolio.id,
        parseInt(timeseriesDays, 10)
      );
      setTimeseries(data as unknown as PortfolioTimeseries[]);
    } catch {
      // silently fail for timeseries
    }
  }, [selectedPortfolio, timeseriesDays]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchTimeseries();
  }, [fetchTimeseries]);

  if (!selectedPortfolio) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <Card className="w-96 text-center">
            <CardHeader>
              <CardTitle>No Portfolio Selected</CardTitle>
              <CardDescription>Select a portfolio to view analytics.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppShell>
    );
  }

  const pnlPositive = (analytics?.totalUnrealizedPnL ?? 0) >= 0;
  const timeseriesSymbols =
    timeseries.length > 0
      ? Object.keys(timeseries[0]).filter((k) => k !== 'date')
      : [];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-serif font-normal">Analytics</h1>
            <p className="text-sm text-muted-foreground mt-1">Portfolio performance &amp; bucket utilization</p>
          </div>
          <Button
            variant="outline"
            onClick={() => fetchAll(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Portfolio Value"
            value={isLoading ? '—' : usd(analytics?.totalCurrentValue ?? 0)}
            sub={`Budget: ${usd(analytics?.totalCapital ?? 0)}`}
            isLoading={isLoading}
          />
          <StatCard
            title="Total Invested"
            value={isLoading ? '—' : usd(analytics?.totalInvested ?? 0)}
            sub={`${analytics?.investedPercent?.toFixed(1) ?? 0}% deployed`}
            isLoading={isLoading}
          />
          <StatCard
            title="Unrealised P&amp;L"
            value={isLoading ? '—' : usd(analytics?.totalUnrealizedPnL ?? 0)}
            sub={pct(analytics?.totalUnrealizedPnLPercent ?? 0)}
            positive={pnlPositive}
            isLoading={isLoading}
          />
          <StatCard
            title="Cash Balance"
            value={isLoading ? '—' : usd(analytics?.cashBalance ?? 0)}
            isLoading={isLoading}
          />
        </div>

        {/* Allocation chart + Bucket usage */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Allocation donut */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Allocation Breakdown</CardTitle>
              <CardDescription>Current value by stock</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : allocationChart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={allocationChart}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="symbol"
                    >
                      {allocationChart.map((entry, i) => (
                        <Cell key={entry.symbol} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => usd(Number(v ?? 0))}
                      labelFormatter={(l) => String(l)}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Bucket usage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bucket Utilization</CardTitle>
              <CardDescription>Core / Dip / Crash deployment</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : bucketUsage.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No data</p>
              ) : (
                <div className="space-y-4 pt-2">
                  {bucketUsage.map((b) => (
                    <div key={b.bucket} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{b.bucket}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {usd(b.used)} / {usd(b.allocated)}
                        </span>
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: BUCKET_COLORS[b.bucket] ?? '#94a3b8',
                            color: BUCKET_COLORS[b.bucket] ?? '#94a3b8',
                          }}
                        >
                          {b.utilizationPercent.toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(b.utilizationPercent, 100)}%`,
                            backgroundColor: BUCKET_COLORS[b.bucket] ?? '#94a3b8',
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {usd(b.remaining)} remaining
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Holdings table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Holdings Performance</CardTitle>
            <CardDescription>P&amp;L by position</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (analytics?.holdings ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No holdings yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Avg Cost</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Invested</TableHead>
                    <TableHead>P&amp;L</TableHead>
                    <TableHead>% Port</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(analytics?.holdings ?? []).map((h) => {
                    const pnlPos = (h.unrealizedPnL ?? 0) >= 0;
                    return (
                      <TableRow key={h.symbol}>
                        <TableCell className="font-medium">{h.symbol}</TableCell>
                        <TableCell className="tabular-nums">{h.sharesOwned?.toFixed(3)}</TableCell>
                        <TableCell className="tabular-nums">
                          {h.avgCostBasis ? usd(h.avgCostBasis) : '—'}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {h.currentPrice ? usd(h.currentPrice) : '—'}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {h.currentValue ? usd(h.currentValue) : '—'}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {h.totalInvested ? usd(h.totalInvested) : '—'}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'tabular-nums font-medium',
                            pnlPos ? 'text-emerald-500' : 'text-red-500'
                          )}
                        >
                          {h.unrealizedPnL != null ? (
                            <>
                              {usd(h.unrealizedPnL)}
                              <span className="text-xs ml-1">
                                ({pct(h.unrealizedPnLPercent ?? 0)})
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {h.allocationPercent?.toFixed(1) ?? '—'}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Price timeseries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Price History</CardTitle>
              <CardDescription>Closing prices over time</CardDescription>
            </div>
            <Select value={timeseriesDays} onValueChange={setTimeseriesDays}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {timeseries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No price history. Sync market data first.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={timeseries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    }
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    formatter={(v, name) => [usd(Number(v ?? 0)), String(name)]}
                    labelFormatter={(l) =>
                      new Date(l).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                    }
                  />
                  <Legend />
                  {timeseriesSymbols.map((sym, i) => (
                    <Line
                      key={sym}
                      type="monotone"
                      dataKey={sym}
                      dot={false}
                      strokeWidth={2}
                      stroke={
                        ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'][i % 6]
                      }
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Dip opportunities */}
        {dips.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                Dip Opportunities
              </CardTitle>
              <CardDescription>Stocks below their 52-week high</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>52W High</TableHead>
                    <TableHead>Dip %</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Bucket Avail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dips.map((d) => (
                    <TableRow key={d.symbol}>
                      <TableCell className="font-medium">{d.symbol}</TableCell>
                      <TableCell className="tabular-nums">{usd(d.currentPrice)}</TableCell>
                      <TableCell className="tabular-nums">{usd(d.fiftyTwoWeekHigh)}</TableCell>
                      <TableCell className="tabular-nums text-orange-500">
                        -{d.dipPercent.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{d.dipLevel.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{d.recommendedAction}</TableCell>
                      <TableCell className="tabular-nums">{usd(d.bucketAvailable)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
