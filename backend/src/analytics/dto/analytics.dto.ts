export class StockAnalyticsDto {
  symbol: string;
  companyName: string | null;
  sharesOwned: number;
  avgCostBasis: number;
  totalInvested: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  
  // Current allocation (based on current value)
  allocationPercent: number;
  targetPercent: number;
  driftPercent: number;
  
  // Allocation progress metrics (matches Excel "Current Positions")
  investedAllocationPercent: number;  // % of total invested in this stock
  expectedAllocationPercent: number;  // Expected % based on investment progress
  allocationProgress: number;         // % of target allocation achieved
  targetAllocationUSD: number;        // Target allocation in USD
  
  // Market data
  fiftyTwoWeekHigh: number;
  dipFromHigh: number;
  
  // DCA tracking
  monthlyDCA: number;
  weeklyDCA: number;
}

export class PortfolioAnalyticsDto {
  portfolioId: string;
  portfolioName: string;
  totalCapital: number;
  totalInvested: number;
  totalCurrentValue: number;
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPercent: number;
  cashBalance: number;
  investedPercent: number;
  
  // Bucket summary
  totalCoreBucket: number;
  totalDipBucket: number;
  totalCrashBucket: number;
  totalCoreUsed: number;
  totalDipUsed: number;
  totalCrashUsed: number;
  coreUtilization: number;
  dipUtilization: number;
  crashUtilization: number;

  // Holdings
  holdings: StockAnalyticsDto[];
  
  // Concentration
  topHolding: string | null;
  topHoldingPercent: number;
  top3HoldingsPercent: number;
}

export class PerformanceDataPointDto {
  date: Date;
  portfolioValue: number;
  invested: number;
  pnl: number;
  pnlPercent: number;
}

export class PerformanceAnalyticsDto {
  portfolioId: string;
  dataPoints: PerformanceDataPointDto[];
  periodReturn: number;
  periodReturnPercent: number;
  startValue: number;
  endValue: number;
  highValue: number;
  lowValue: number;
}

export class AllocationChartDataDto {
  symbol: string;
  value: number;
  percentage: number;
  color: string;
}

export class BucketUsageDto {
  bucket: string;
  allocated: number;
  used: number;
  remaining: number;
  utilizationPercent: number;
}

export class DipOpportunityDto {
  symbol: string;
  currentPrice: number;
  fiftyTwoWeekHigh: number;
  dipPercent: number;
  dipLevel: string;
  recommendedAction: string;
  bucketAvailable: number;
}
