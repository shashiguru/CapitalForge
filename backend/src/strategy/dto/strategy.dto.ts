import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export enum DipLevel {
  NORMAL_DCA = 'NORMAL_DCA',      // <10%
  LIGHT_DIP = 'LIGHT_DIP',        // 10-15%
  MODERATE_DIP = 'MODERATE_DIP',  // 15-20%
  DIP_BUCKET = 'DIP_BUCKET',      // 20-30%
  CRASH_BUCKET = 'CRASH_BUCKET',  // >30%
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

// Pre-computed strategy table (matches Excel Strategy worksheet)
export class DipLevelThresholdDto {
  dipPercent: number;        // 10, 15, 20, 30
  thresholdPrice: number;    // Price at this dip level
  buyUSD: number;            // Buy amount at this level
  weeklyDipUSD: number;      // Weekly dip buy amount
  bucketUsed: BucketType;    // Which bucket to use
}

export class StockStrategyTableDto {
  symbol: string;
  companyName: string | null;
  fiftyTwoWeekHigh: number;
  currentPrice: number;
  currentDipPercent: number;
  targetAllocationUSD: number;
  weeklyDCA: number;
  
  // Thresholds at each dip level
  levels: {
    tenPercent: DipLevelThresholdDto;      // 10% dip
    fifteenPercent: DipLevelThresholdDto;  // 15% dip
    twentyPercent: DipLevelThresholdDto;   // 20% dip
    thirtyPercent: DipLevelThresholdDto;   // 30% dip
  };
}

export class PortfolioStrategyTableDto {
  portfolioId: string;
  portfolioName: string;
  totalWeeklyDCA: number;
  asOfDate: Date;
  stocks: StockStrategyTableDto[];
}

// Stored strategy rules (user's predefined buy plan from spreadsheet)
export class StrategyRuleLevelDto {
  dipPercent: number;
  dipLabel: string;
  thresholdPrice: number;
  buyQuantity: number;
  weeklyDipQuantity: number | null;
}

export class StockStrategyRulesDto {
  symbol: string;
  fiftyTwoWeekHigh: number;
  levels: StrategyRuleLevelDto[];
}

export class StoredStrategyRulesDto {
  portfolioId: string;
  portfolioName: string;
  stocks: StockStrategyRulesDto[];
}
