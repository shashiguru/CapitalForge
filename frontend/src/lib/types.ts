// Auth Types
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  accessToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name?: string;
}

// Portfolio Types
export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  totalCapital: number;
  strategyReferenceBudget: number | null;
  budgetYearStart: string | null;
  budgetYearEnd: string | null;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  allocationsCount?: number;
  transactionsCount?: number;
}

export interface PortfolioSummary {
  id: string;
  name: string;
  totalCapital: number;
  currency: string;
  totalAllocated: number;
  totalInvested: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  allocationsCount: number;
}

export interface CreatePortfolioDto {
  name: string;
  description?: string;
  totalCapital?: number;
  strategyReferenceBudget?: number;
  budgetYearStart?: string;
  budgetYearEnd?: string;
  currency?: string;
}

export interface BudgetPreset {
  id: string;
  portfolioId: string;
  name: string;
  totalCapital: number;
  strategyReferenceBudget: number | null;
  budgetYearStart: string | null;
  budgetYearEnd: string | null;
  createdAt: Date;
}

// Allocation Types
export interface Allocation {
  id: string;
  portfolioId: string;
  symbol: string;
  companyName: string | null;
  targetPercentage: number;
  allocationUSD: number;
  
  // Bucket allocations
  coreBucketUSD: number;
  dipBucketUSD: number;
  crashBucketUSD: number;
  
  // DCA breakdown (from Core bucket)
  monthlyDCA: number;
  weeklyDCA: number;
  
  // Bucket usage
  coreUsedUSD: number;
  dipUsedUSD: number;
  crashUsedUSD: number;
  
  // Remaining balances
  coreRemainingUSD: number;
  dipRemainingUSD: number;
  crashRemainingUSD: number;
  
  // Position tracking
  sharesOwned: number;
  avgCostBasis: number;
  investedValue: number;
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AllocationSummary {
  totalTargetPercentage: number;
  totalAllocationUSD: number;
  
  // Bucket totals
  totalCoreBucketUSD: number;
  totalDipBucketUSD: number;
  totalCrashBucketUSD: number;
  
  // DCA totals
  totalMonthlyDCA: number;
  totalWeeklyDCA: number;
  
  // Usage totals
  totalCoreUsedUSD: number;
  totalDipUsedUSD: number;
  totalCrashUsedUSD: number;
  
  // Remaining totals
  totalCoreRemainingUSD: number;
  totalDipRemainingUSD: number;
  totalCrashRemainingUSD: number;
  
  // Portfolio stats
  totalInvestedValue: number;
  allocationsCount: number;
  unallocatedPercentage: number;
  unallocatedUSD: number;
}

export interface CreateAllocationDto {
  symbol: string;
  companyName?: string;
  targetPercentage: number;
}

// Market Data Types
export interface MarketDataSummary {
  symbol: string;
  latestPrice: number;
  latestDate: Date;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  dipFromHigh: number;
  change24h: number;
  changePercent24h: number;
}

export interface SyncResult {
  success: boolean;
  symbolsSynced: string[];
  symbolsFailed: string[];
  lastSyncDate: Date;
  errors?: string[];
}

// Strategy Types
export enum DipLevel {
  NORMAL_DCA = 'NORMAL_DCA',
  LIGHT_DIP = 'LIGHT_DIP',
  MODERATE_DIP = 'MODERATE_DIP',
  DIP_BUCKET = 'DIP_BUCKET',
  CRASH_BUCKET = 'CRASH_BUCKET',
}

export enum BucketType {
  CORE = 'CORE',
  DIP = 'DIP',
  CRASH = 'CRASH',
}

export interface BuyPlan {
  id: string;
  snapshotId: string;
  symbol: string;
  currentPrice: number;
  fiftyTwoWeekHigh: number;
  dipPercentage: number;
  dipLevelTriggered: DipLevel;
  suggestedPrice: number;
  suggestedQuantity: number;
  capitalRequired: number;
  bucketUsed: BucketType;
  reason: string;
  priority: number;
  isApproved: boolean;
  isExecuted: boolean;
  executedAt: Date | null;
}

export interface StrategySnapshot {
  id: string;
  portfolioId: string;
  asOfDate: Date;
  totalBudget: number;
  status: string;
  notes: string | null;
  buyPlans: BuyPlan[];
  createdAt: Date;
}

// Budget Types
export interface WeeklyBudget {
  id: string;
  portfolioId: string;
  weekStartDate: Date;
  plannedAmount: number;
  usedAmount: number;
  remainingAmount: number;
  carryForward: boolean;
  notes: string | null;
  utilizationPercent: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetSummary {
  currentWeekBudget: WeeklyBudget | null;
  totalBudgetedThisMonth: number;
  totalUsedThisMonth: number;
  averageWeeklyBudget: number;
  totalWeeks: number;
}

export interface CreateBudgetDto {
  plannedAmount: number;
  weekStartDate?: string;
  carryForward?: boolean;
  notes?: string;
}

// Transaction Types
export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  DIVIDEND = 'DIVIDEND',
  FEE = 'FEE',
}

export interface Transaction {
  id: string;
  portfolioId: string;
  symbol: string;
  type: TransactionType;
  price: number;
  quantity: number;
  total: number;
  fees: number;
  notes: string | null;
  date: Date;
  executedAt: Date;
  createdAt: Date;
}

export interface TransactionSummary {
  totalBuys: number;
  totalSells: number;
  totalDividends: number;
  totalFees: number;
  netInvested: number;
  transactionCount: number;
}

export interface CreateTransactionDto {
  symbol: string;
  type: TransactionType;
  price: number;
  quantity: number;
  fees?: number;
  notes?: string;
  date: string;
}

// Analytics Types
export interface StockAnalytics {
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

export interface PortfolioAnalytics {
  portfolioId: string;
  portfolioName: string;
  totalCapital: number;
  totalInvested: number;
  totalCurrentValue: number;
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPercent: number;
  cashBalance: number;
  investedPercent: number;
  totalCoreBucket: number;
  totalDipBucket: number;
  totalCrashBucket: number;
  totalCoreUsed: number;
  totalDipUsed: number;
  totalCrashUsed: number;
  coreUtilization: number;
  dipUtilization: number;
  crashUtilization: number;
  holdings: StockAnalytics[];
  topHolding: string | null;
  topHoldingPercent: number;
  top3HoldingsPercent: number;
}

export interface AllocationChartData {
  symbol: string;
  value: number;
  percentage: number;
  color: string;
}

export interface BucketUsage {
  bucket: string;
  allocated: number;
  used: number;
  remaining: number;
  utilizationPercent: number;
}

export interface DipOpportunity {
  symbol: string;
  currentPrice: number;
  fiftyTwoWeekHigh: number;
  dipPercent: number;
  dipLevel: string;
  recommendedAction: string;
  bucketAvailable: number;
}

// Strategy Table Types (matches Excel Strategy worksheet)
export interface DipLevelThreshold {
  dipPercent: number;
  thresholdPrice: number;
  buyUSD: number;
  weeklyDipUSD: number;
  bucketUsed: BucketType;
}

export interface StockStrategyTable {
  symbol: string;
  companyName: string | null;
  fiftyTwoWeekHigh: number;
  currentPrice: number;
  currentDipPercent: number;
  targetAllocationUSD: number;
  weeklyDCA: number;
  levels: {
    tenPercent: DipLevelThreshold;
    fifteenPercent: DipLevelThreshold;
    twentyPercent: DipLevelThreshold;
    thirtyPercent: DipLevelThreshold;
  };
}

export interface PortfolioStrategyTable {
  portfolioId: string;
  portfolioName: string;
  totalWeeklyDCA: number;
  asOfDate: Date;
  stocks: StockStrategyTable[];
}

// Stored strategy rules (user's predefined buy plan from spreadsheet)
export interface StrategyRuleLevel {
  dipPercent: number;
  dipLabel: string;
  thresholdPrice: number;
  buyQuantity: number;
  weeklyDipQuantity: number | null;
}

export interface StockStrategyRules {
  symbol: string;
  fiftyTwoWeekHigh: number;
  levels: StrategyRuleLevel[];
}

export interface StoredStrategyRules {
  portfolioId: string;
  portfolioName: string;
  stocks: StockStrategyRules[];
}
