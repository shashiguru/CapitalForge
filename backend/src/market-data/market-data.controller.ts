import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import {
  SyncMarketDataDto,
  PriceDailyDto,
  MarketDataSummaryDto,
  SyncResultDto,
} from './dto/market-data.dto';

@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncMarketData(@Body() dto: SyncMarketDataDto): Promise<SyncResultDto> {
    if (dto.portfolioId) {
      return this.marketDataService.syncPortfolioSymbols(dto.portfolioId);
    }
    if (dto.symbols?.length) {
      return this.marketDataService.syncSymbols(dto.symbols);
    }
    return {
      success: false,
      symbolsSynced: [],
      symbolsFailed: [],
      lastSyncDate: new Date(),
      errors: ['Provide portfolioId or symbols to sync'],
    };
  }

  @Get('prices/:symbol')
  async getLatestPrice(
    @Param('symbol') symbol: string,
  ): Promise<PriceDailyDto | null> {
    return this.marketDataService.getLatestPrice(symbol);
  }

  @Get('prices/:symbol/history')
  async getPriceHistory(
    @Param('symbol') symbol: string,
    @Query('days') days?: string,
  ): Promise<PriceDailyDto[]> {
    return this.marketDataService.getPriceHistory(
      symbol,
      days ? parseInt(days, 10) : 365,
    );
  }

  @Get('summary/:symbol')
  async getMarketDataSummary(
    @Param('symbol') symbol: string,
  ): Promise<MarketDataSummaryDto | null> {
    return this.marketDataService.getMarketDataSummary(symbol);
  }

  @Post('summary/batch')
  @HttpCode(HttpStatus.OK)
  async getMultipleSummaries(
    @Body() body: { symbols: string[] },
  ): Promise<MarketDataSummaryDto[]> {
    return this.marketDataService.getMultipleMarketDataSummaries(body.symbols);
  }
}
