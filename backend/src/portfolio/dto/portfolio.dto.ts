import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  MaxLength,
  IsBoolean,
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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  strategyReferenceBudget?: number;

  @IsOptional()
  budgetYearStart?: string; // ISO date YYYY-MM-DD

  @IsOptional()
  budgetYearEnd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;
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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  strategyReferenceBudget?: number;

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
}

export class PortfolioResponseDto {
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
