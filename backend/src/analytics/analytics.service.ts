import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { MarketDataService } from '../market-data/market-data.service';
import {
  PortfolioAnalyticsDto,
  StockAnalyticsDto,
  PerformanceAnalyticsDto,
  AllocationChartDataDto,
  BucketUsageDto,
  DipOpportunityDto,
} from './dto/analytics.dto';

@Injectable()
export class AnalyticsService {
  private readonly CHART_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  ];

  constructor(
    private prisma: PrismaService,
    private portfolioService: PortfolioService,
    private marketDataService: MarketDataService,
  ) {}

  async getPortfolioAnalytics(
    portfolioId: string,
    userId: string,
  ): Promise<PortfolioAnalyticsDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        allocations: { where: { isActive: true } },
        transactions: true,
      },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const symbols = portfolio.allocations.map((a) => a.symbol);
    const marketData = await this.marketDataService.getMultipleMarketDataSummaries(symbols);
    const marketDataMap = new Map(marketData.map((m) => [m.symbol, m]));

    // Get total capital upfront for calculations
    const totalCapital = Number(portfolio.totalCapital);

    // Calculate holdings analytics
    const holdings: StockAnalyticsDto[] = [];
    let totalCurrentValue = 0;
    let totalInvested = 0;

    // Bucket totals
    let totalCoreBucket = 0;
    let totalDipBucket = 0;
    let totalCrashBucket = 0;
    let totalCoreUsed = 0;
    let totalDipUsed = 0;
    let totalCrashUsed = 0;

    for (const allocation of portfolio.allocations) {
      const market = marketDataMap.get(allocation.symbol);
      const currentPrice = market?.latestPrice || 0;
      const fiftyTwoWeekHigh = market?.fiftyTwoWeekHigh || 0;
      const sharesOwned = Number(allocation.sharesOwned);
      const avgCostBasis = Number(allocation.avgCostBasis);
      const targetAllocationUSD = Number(allocation.allocationUSD);
      const monthlyDCA = Number(allocation.monthlyDCA || 0);
      const weeklyDCA = Number(allocation.weeklyDCA || 0);
      
      const stockInvested = sharesOwned * avgCostBasis;
      const stockValue = sharesOwned * currentPrice;
      const unrealizedPnL = stockValue - stockInvested;
      const unrealizedPnLPercent = stockInvested > 0
        ? (unrealizedPnL / stockInvested) * 100
        : 0;

      totalInvested += stockInvested;
      totalCurrentValue += stockValue;

      // Accumulate bucket totals
      totalCoreBucket += Number(allocation.coreBucketUSD);
      totalDipBucket += Number(allocation.dipBucketUSD);
      totalCrashBucket += Number(allocation.crashBucketUSD);
      totalCoreUsed += Number(allocation.coreUsedUSD);
      totalDipUsed += Number(allocation.dipUsedUSD);
      totalCrashUsed += Number(allocation.crashUsedUSD);

      holdings.push({
        symbol: allocation.symbol,
        companyName: allocation.companyName,
        sharesOwned,
        avgCostBasis,
        totalInvested: stockInvested,
        currentPrice,
        currentValue: stockValue,
        unrealizedPnL,
        unrealizedPnLPercent,
        allocationPercent: 0, // Will calculate after total
        targetPercent: Number(allocation.targetPercentage),
        driftPercent: 0, // Will calculate after total
        investedAllocationPercent: 0, // Will calculate after total
        expectedAllocationPercent: 0, // Will calculate after total
        allocationProgress: 0, // Will calculate after total
        targetAllocationUSD,
        fiftyTwoWeekHigh,
        dipFromHigh: market?.dipFromHigh || 0,
        monthlyDCA,
        weeklyDCA,
      });
    }

    // Calculate allocation percentages and drift
    for (const holding of holdings) {
      // Current allocation % (based on current value)
      holding.allocationPercent = totalCurrentValue > 0
        ? (holding.currentValue / totalCurrentValue) * 100
        : 0;
      holding.driftPercent = holding.allocationPercent - holding.targetPercent;
      
      // Invested allocation % (based on invested amount)
      holding.investedAllocationPercent = totalInvested > 0
        ? (holding.totalInvested / totalInvested) * 100
        : 0;
      
      // Expected allocation % (target % normalized by portfolio utilization)
      const portfolioUtilization = totalCapital > 0 ? totalInvested / totalCapital : 0;
      holding.expectedAllocationPercent = holding.targetPercent * portfolioUtilization;
      
      // Allocation progress % (how much of target allocation is filled)
      holding.allocationProgress = holding.targetAllocationUSD > 0
        ? (holding.totalInvested / holding.targetAllocationUSD) * 100
        : 0;
    }

    // Sort by value descending
    holdings.sort((a, b) => b.currentValue - a.currentValue);

    const totalUnrealizedPnL = totalCurrentValue - totalInvested;
    const totalUnrealizedPnLPercent = totalInvested > 0
      ? (totalUnrealizedPnL / totalInvested) * 100
      : 0;

    const cashBalance = totalCapital - totalInvested;
    const investedPercent = totalCapital > 0
      ? (totalInvested / totalCapital) * 100
      : 0;

    // Concentration metrics
    const topHolding = holdings[0]?.symbol || null;
    const topHoldingPercent = holdings[0]?.allocationPercent || 0;
    const top3HoldingsPercent = holdings
      .slice(0, 3)
      .reduce((sum, h) => sum + h.allocationPercent, 0);

    // Bucket utilization
    const coreUtilization = totalCoreBucket > 0
      ? (totalCoreUsed / totalCoreBucket) * 100
      : 0;
    const dipUtilization = totalDipBucket > 0
      ? (totalDipUsed / totalDipBucket) * 100
      : 0;
    const crashUtilization = totalCrashBucket > 0
      ? (totalCrashUsed / totalCrashBucket) * 100
      : 0;

    return {
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      totalCapital,
      totalInvested,
      totalCurrentValue,
      totalUnrealizedPnL,
      totalUnrealizedPnLPercent,
      cashBalance,
      investedPercent,
      totalCoreBucket,
      totalDipBucket,
      totalCrashBucket,
      totalCoreUsed,
      totalDipUsed,
      totalCrashUsed,
      coreUtilization,
      dipUtilization,
      crashUtilization,
      holdings,
      topHolding,
      topHoldingPercent,
      top3HoldingsPercent,
    };
  }

  async getAllocationChartData(
    portfolioId: string,
    userId: string,
  ): Promise<AllocationChartDataDto[]> {
    const analytics = await this.getPortfolioAnalytics(portfolioId, userId);

    return analytics.holdings.map((h, index) => ({
      symbol: h.symbol,
      value: h.currentValue,
      percentage: h.allocationPercent,
      color: this.CHART_COLORS[index % this.CHART_COLORS.length],
    }));
  }

  async getBucketUsage(
    portfolioId: string,
    userId: string,
  ): Promise<BucketUsageDto[]> {
    const analytics = await this.getPortfolioAnalytics(portfolioId, userId);

    return [
      {
        bucket: 'Core',
        allocated: analytics.totalCoreBucket,
        used: analytics.totalCoreUsed,
        remaining: analytics.totalCoreBucket - analytics.totalCoreUsed,
        utilizationPercent: analytics.coreUtilization,
      },
      {
        bucket: 'Dip',
        allocated: analytics.totalDipBucket,
        used: analytics.totalDipUsed,
        remaining: analytics.totalDipBucket - analytics.totalDipUsed,
        utilizationPercent: analytics.dipUtilization,
      },
      {
        bucket: 'Crash',
        allocated: analytics.totalCrashBucket,
        used: analytics.totalCrashUsed,
        remaining: analytics.totalCrashBucket - analytics.totalCrashUsed,
        utilizationPercent: analytics.crashUtilization,
      },
    ];
  }

  async getDipOpportunities(
    portfolioId: string,
    userId: string,
  ): Promise<DipOpportunityDto[]> {
    const analytics = await this.getPortfolioAnalytics(portfolioId, userId);
    const buckets = await this.getBucketUsage(portfolioId, userId);
    
    const dipBucketRemaining = buckets.find(b => b.bucket === 'Dip')?.remaining || 0;
    const crashBucketRemaining = buckets.find(b => b.bucket === 'Crash')?.remaining || 0;

    const opportunities: DipOpportunityDto[] = [];

    for (const holding of analytics.holdings) {
      if (holding.dipFromHigh >= 10) {
        let dipLevel: string;
        let recommendedAction: string;
        let bucketAvailable: number;

        if (holding.dipFromHigh >= 30) {
          dipLevel = 'CRASH';
          recommendedAction = 'Deploy crash bucket capital';
          bucketAvailable = crashBucketRemaining;
        } else if (holding.dipFromHigh >= 20) {
          dipLevel = 'SIGNIFICANT';
          recommendedAction = 'Deploy dip bucket capital';
          bucketAvailable = dipBucketRemaining;
        } else if (holding.dipFromHigh >= 15) {
          dipLevel = 'MODERATE';
          recommendedAction = 'Consider increasing DCA';
          bucketAvailable = dipBucketRemaining;
        } else {
          dipLevel = 'LIGHT';
          recommendedAction = 'Monitor for further dip';
          bucketAvailable = 0;
        }

        opportunities.push({
          symbol: holding.symbol,
          currentPrice: holding.currentPrice,
          fiftyTwoWeekHigh: holding.fiftyTwoWeekHigh,
          dipPercent: holding.dipFromHigh,
          dipLevel,
          recommendedAction,
          bucketAvailable,
        });
      }
    }

    // Sort by dip percentage descending
    opportunities.sort((a, b) => b.dipPercent - a.dipPercent);

    return opportunities;
  }

  async getPerformanceAnalytics(
    portfolioId: string,
    userId: string,
    days: number = 30,
  ): Promise<PerformanceAnalyticsDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    // Get transactions for the period
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        portfolioId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    // Get current portfolio value
    const analytics = await this.getPortfolioAnalytics(portfolioId, userId);

    // For now, return simplified performance data
    // In a real implementation, you'd calculate daily values
    const dataPoints = [{
      date: new Date(),
      portfolioValue: analytics.totalCurrentValue,
      invested: analytics.totalInvested,
      pnl: analytics.totalUnrealizedPnL,
      pnlPercent: analytics.totalUnrealizedPnLPercent,
    }];

    return {
      portfolioId,
      dataPoints,
      periodReturn: analytics.totalUnrealizedPnL,
      periodReturnPercent: analytics.totalUnrealizedPnLPercent,
      startValue: analytics.totalInvested,
      endValue: analytics.totalCurrentValue,
      highValue: analytics.totalCurrentValue,
      lowValue: analytics.totalInvested,
    };
  }
}
