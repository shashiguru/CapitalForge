import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsBoolean,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePortfolioDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalCapital?: number;

  @IsOptional()
  budgetYearStart?: string;

  @IsOptional()
  budgetYearEnd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  coreRatio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  dipRatio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  crashRatio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52)
  dcaWeeksPerYear?: number;
}

export class UpdatePortfolioDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalCapital?: number;

  @IsOptional()
  budgetYearStart?: string;

  @IsOptional()
  budgetYearEnd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  coreRatio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  dipRatio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  crashRatio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52)
  dcaWeeksPerYear?: number;
}

export class PortfolioResponseDto {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  totalCapital: number;
  budgetYearStart: string | null;
  budgetYearEnd: string | null;
  currency: string;
  coreRatio: number;
  dipRatio: number;
  crashRatio: number;
  dcaWeeksPerYear: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  allocationsCount?: number;
  transactionsCount?: number;
}

export class PortfolioSummaryDto {
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
