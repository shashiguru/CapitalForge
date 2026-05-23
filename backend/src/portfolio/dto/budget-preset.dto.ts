import { IsString, IsNumber, IsOptional, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBudgetPresetDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalCapital: number;

  @IsOptional()
  budgetYearStart?: string;

  @IsOptional()
  budgetYearEnd?: string;
}

export class UpdateBudgetPresetDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalCapital?: number;

  @IsOptional()
  budgetYearStart?: string;

  @IsOptional()
  budgetYearEnd?: string;
}

export class BudgetPresetResponseDto {
  id: string;
  portfolioId: string;
  name: string;
  totalCapital: number;
  budgetYearStart: string | null;
  budgetYearEnd: string | null;
  createdAt: Date;
}
