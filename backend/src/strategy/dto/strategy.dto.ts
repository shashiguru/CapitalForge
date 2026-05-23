import { IsString, IsOptional, IsNumber, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum DipLevel {
  NORMAL_DCA = 'NORMAL_DCA',      // <10%
  LIGHT_DIP = 'LIGHT_DIP',        // 10-15%
  MODERATE_DIP = 'MODERATE_DIP',  // 15-20%
  DIP_BUCKET = 'DIP_BUCKET',      // 20-30%
  CRASH_BUCKET = 'CRASH_BUCKET',  // >=30%
}

export enum BucketType {
  CORE = 'CORE',
  DIP = 'DIP',
  CRASH = 'CRASH',
}

export class GenerateStrategyDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weeklyBudget?: number;
}

export class BuyPlanDto {
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

export class StrategySnapshotDto {
  id: string;
  portfolioId: string;
  asOfDate: Date;
  totalBudget: number;
  status: string;
  notes: string | null;
  buyPlans: BuyPlanDto[];
  createdAt: Date;
}

export class ExecuteBuyPlanDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  executedPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  executedQuantity?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveBuyPlanDto {
  @IsBoolean()
  approved: boolean;
}

// Live strategy table — one row per stock, columns = dip levels
export class DipLevelThresholdDto {
  dipPercent: number;
  dipLabel: string;
  thresholdPrice: number;
  buyUSD: number;           // weeklyDCA × multiplier
  buyShares: number;        // floor(buyUSD / currentPrice)
  weeklyDipUSD: number;     // weeklyDCA × weeklyDipMultiplier
  multiplier: number;       // the raw multiplier (1, 3, or 5)
  bucketUsed: BucketType;
  isActive: boolean;        // current price is at or below this threshold
}

export class StockStrategyTableDto {
  symbol: string;
  companyName: string | null;
  isAggressive: boolean;
  // The reference high stored in Allocation (user-managed)
  storedFiftyTwoWeekHigh: number | null;
  fiftyTwoWeekHighUpdatedAt: Date | null;
  // Live from Yahoo Finance
  liveFiftyTwoWeekHigh: number;
  currentPrice: number;
  currentDipPercent: number;
  currentDipLevel: DipLevel;
  targetAllocationUSD: number;
  weeklyDCA: number;
  // Bucket remaining
  coreRemainingUSD: number;
  dipRemainingUSD: number;
  crashRemainingUSD: number;
  // Intra-week dip trigger
  isWeeklyDipTriggered: boolean;
  weeklyDipOpportunityUSD: number;
  lastWeeklyBuyPrice: number | null;
  // Levels
  levels: DipLevelThresholdDto[];
}

export class PortfolioStrategyTableDto {
  portfolioId: string;
  portfolioName: string;
  totalWeeklyDCA: number;
  asOfDate: Date;
  stocks: StockStrategyTableDto[];
}

// Upsert strategy rule for a single dip level
export class UpsertStrategyRuleDto {
  @IsString()
  symbol: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  dipPercent: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  buyMultiplier: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  weeklyDipMultiplier?: number;
}

export class StrategyRuleLevelDto {
  dipPercent: number;
  dipLabel: string;
  buyMultiplier: number;
  weeklyDipMultiplier: number;
  // Computed from current weeklyDCA
  buyUSD: number;
  buyShares: number;
  weeklyDipUSD: number;
  thresholdPrice: number;
}

export class StockStrategyRulesDto {
  symbol: string;
  isAggressive: boolean;
  fiftyTwoWeekHigh: number | null;
  weeklyDCA: number;
  levels: StrategyRuleLevelDto[];
}

export class StoredStrategyRulesDto {
  portfolioId: string;
  portfolioName: string;
  stocks: StockStrategyRulesDto[];
}
