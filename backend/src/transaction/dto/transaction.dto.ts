import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  DIVIDEND = 'DIVIDEND',
  FEE = 'FEE',
}

export class CreateTransactionDto {
  @IsString()
  symbol: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @Type(() => Number)
  @IsNumber()
  price: number;

  @Type(() => Number)
  @IsNumber()
  quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fees?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsDateString()
  date: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fees?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class TransactionResponseDto {
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

export class TransactionFilterDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number;
}

export class ImportTransactionDto {
  @IsString()
  symbol: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @Type(() => Number)
  @IsNumber()
  price: number;

  @Type(() => Number)
  @IsNumber()
  quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fees?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsDateString()
  date: string;
}

export class BulkImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTransactionDto)
  transactions: ImportTransactionDto[];
}

export class TransactionSummaryDto {
  totalBuys: number;
  totalSells: number;
  totalDividends: number;
  totalFees: number;
  netInvested: number;
  transactionCount: number;
}
