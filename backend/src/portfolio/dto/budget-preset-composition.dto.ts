import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BudgetPresetStockDto {
  @IsString()
  symbol: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(100)
  targetPercentage: number;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsBoolean()
  isAggressive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fiftyTwoWeekHigh?: number;
}

export class SaveBudgetPresetCompositionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetPresetStockDto)
  stocks: BudgetPresetStockDto[];
}

export class BudgetPresetStockResponseDto {
  id: string;
  budgetPresetId: string;
  symbol: string;
  companyName: string | null;
  targetPercentage: number;
  isAggressive: boolean;
  fiftyTwoWeekHigh: number | null;
  sortOrder: number;
}
