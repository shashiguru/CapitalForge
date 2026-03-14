import { IsNumber, IsOptional, IsBoolean, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWeeklyBudgetDto {
  @Type(() => Number)
  @IsNumber()
  plannedAmount: number;

  @IsOptional()
  @IsDateString()
  weekStartDate?: string;

  @IsOptional()
  @IsBoolean()
  carryForward?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateWeeklyBudgetDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  plannedAmount?: number;

  @IsOptional()
  @IsBoolean()
  carryForward?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class WeeklyBudgetResponseDto {
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

export class BudgetSummaryDto {
  currentWeekBudget: WeeklyBudgetResponseDto | null;
  totalBudgetedThisMonth: number;
  totalUsedThisMonth: number;
  averageWeeklyBudget: number;
  totalWeeks: number;
}
