'use client';

import { useEffect, useState } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { analyticsApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import type { PortfolioAnalytics, AllocationChartData, BucketUsage } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, Percent, Target, PiggyBank } from 'lucide-react';

export default function AnalyticsPage() {
  const { selectedPortfolio } = usePortfolio();
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [chartData, setChartData] = useState<AllocationChartData[]>([]);
  const [bucketData, setBucketData] = useState<BucketUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedPortfolio) return;

      setIsLoading(true);
      try {
        const [analyticsData, chartDataRes, bucketsData] = await Promise.all([
          analyticsApi.getPortfolioAnalytics(selectedPortfolio.id),
          analyticsApi.getAllocationChartData(selectedPortfolio.id),
          analyticsApi.getBucketUsage(selectedPortfolio.id),
        ]);
        setAnalytics(analyticsData);
        setChartData(chartDataRes);
        setBucketData(bucketsData);
      } catch (error) {
        toast.error('Failed to fetch analytics');
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
              <CardDescription>Select a portfolio to view analytics.</CardDescription>
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
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Portfolio performance and insights</p>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Portfolio Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <>
                  <div className="text-2xl font-bold">${analytics?.totalCurrentValue.toLocaleString()}</div>
                  <p className={cn(
                    'text-xs flex items-center mt-1',
                    (analytics?.totalUnrealizedPnL || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                  )}>
                    {(analytics?.totalUnrealizedPnL || 0) >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {analytics?.totalUnrealizedPnLPercent.toFixed(1)}% all time
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unrealized P&L</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className={cn(
                    'text-2xl font-bold',
                    (analytics?.totalUnrealizedPnL || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                  )}>
                    {(analytics?.totalUnrealizedPnL || 0) >= 0 ? '+' : ''}${analytics?.totalUnrealizedPnL.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    On ${analytics?.totalInvested.toLocaleString()} invested
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cash Balance</CardTitle>
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">${analytics?.cashBalance.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(100 - (analytics?.investedPercent || 0)).toFixed(1)}% undeployed
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Concentration</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{analytics?.topHoldingPercent.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Top holding: {analytics?.topHolding || 'N/A'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Allocation Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Allocation Breakdown</CardTitle>
              <CardDescription>Portfolio allocation by position</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-80 flex items-center justify-center">
                  <Skeleton className="h-64 w-64 rounded-full" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No allocations to display
                </div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(1)}%`}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => `$${Number(value).toLocaleString()}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bucket Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Bucket Utilization</CardTitle>
              <CardDescription>Capital deployment by strategy bucket</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-80 flex items-center justify-center">
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : bucketData.length === 0 ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No bucket data to display
                </div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={bucketData}
                      layout="vertical"
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <XAxis type="number" tickFormatter={(v) => `$${v.toLocaleString()}`} />
                      <YAxis dataKey="bucket" type="category" />
                      <Tooltip
                        formatter={(value: any) => `$${Number(value).toLocaleString()}`}
                      />
                      <Legend />
                      <Bar dataKey="used" stackId="a" fill="#3B82F6" name="Used" />
                      <Bar dataKey="remaining" stackId="a" fill="#E5E7EB" name="Remaining" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Holdings Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Holdings Performance</CardTitle>
            <CardDescription>Detailed performance by position</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !analytics?.holdings || analytics.holdings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No holdings to display
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Symbol</th>
                      <th className="text-right py-3 px-2 font-medium">Shares</th>
                      <th className="text-right py-3 px-2 font-medium">Avg Cost</th>
                      <th className="text-right py-3 px-2 font-medium">Current</th>
                      <th className="text-right py-3 px-2 font-medium">Value</th>
                      <th className="text-right py-3 px-2 font-medium">P&L</th>
                      <th className="text-right py-3 px-2 font-medium">P&L %</th>
                      <th className="text-right py-3 px-2 font-medium">Allocation</th>
                      <th className="text-right py-3 px-2 font-medium">Target</th>
                      <th className="text-right py-3 px-2 font-medium">Drift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.holdings.map((holding) => (
                      <tr key={holding.symbol} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium">{holding.symbol}</p>
                            {holding.companyName && (
                              <p className="text-xs text-muted-foreground">{holding.companyName}</p>
                            )}
                          </div>
                        </td>
                        <td className="text-right py-3 px-2">{holding.sharesOwned.toFixed(2)}</td>
                        <td className="text-right py-3 px-2">${holding.avgCostBasis.toFixed(2)}</td>
                        <td className="text-right py-3 px-2">${holding.currentPrice.toFixed(2)}</td>
                        <td className="text-right py-3 px-2 font-medium">${holding.currentValue.toLocaleString()}</td>
                        <td className={cn(
                          'text-right py-3 px-2 font-medium',
                          holding.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
                        )}>
                          {holding.unrealizedPnL >= 0 ? '+' : ''}${holding.unrealizedPnL.toFixed(2)}
                        </td>
                        <td className={cn(
                          'text-right py-3 px-2',
                          holding.unrealizedPnLPercent >= 0 ? 'text-green-500' : 'text-red-500'
                        )}>
                          {holding.unrealizedPnLPercent >= 0 ? '+' : ''}{holding.unrealizedPnLPercent.toFixed(1)}%
                        </td>
                        <td className="text-right py-3 px-2">{holding.allocationPercent.toFixed(1)}%</td>
                        <td className="text-right py-3 px-2">{holding.targetPercent.toFixed(1)}%</td>
                        <td className={cn(
                          'text-right py-3 px-2',
                          Math.abs(holding.driftPercent) > 5 ? 'text-yellow-500' : 'text-muted-foreground'
                        )}>
                          {holding.driftPercent >= 0 ? '+' : ''}{holding.driftPercent.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
