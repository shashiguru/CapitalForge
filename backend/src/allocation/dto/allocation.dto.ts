import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAllocationDto {
  @IsString()
  @MaxLength(10)
  symbol: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyName?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  targetPercentage: number;
}

export class UpdateAllocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  targetPercentage?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkUpdateAllocationDto {
  @IsString()
  symbol: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  targetPercentage: number;
}

export class AllocationResponseDto {
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

export class AllocationSummaryDto {
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

export class BucketConfigDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  coreRatio: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  dipRatio: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  crashRatio: number;
}
