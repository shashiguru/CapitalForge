import { IsString, IsArray, IsOptional, ArrayMinSize } from 'class-validator';

export class SyncMarketDataDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[];

  @IsOptional()
  @IsString()
  portfolioId?: string;
}

export class PriceDailyDto {
  id: string;
  symbol: string;
  date: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

export class MarketDataSummaryDto {
  symbol: string;
  latestPrice: number;
  latestDate: Date;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  dipFromHigh: number;
  change24h: number;
  changePercent24h: number;
}

export class SyncResultDto {
  success: boolean;
  symbolsSynced: string[];
  symbolsFailed: string[];
  lastSyncDate: Date;
  errors?: string[];
}
