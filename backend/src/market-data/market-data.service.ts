import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import YahooFinance from 'yahoo-finance2';
import {
  PriceDailyDto,
  MarketDataSummaryDto,
  SyncResultDto,
} from './dto/market-data.dto';

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly retryAttempts: number;
  private readonly retryDelay: number;
  private readonly yahooFinance = new YahooFinance();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.retryAttempts = this.configService.get<number>('YAHOO_RETRY_ATTEMPTS', 3);
    this.retryDelay = this.configService.get<number>('YAHOO_RETRY_DELAY', 1000);
  }

  async syncSymbols(symbols: string[]): Promise<SyncResultDto> {
    // Use quote API for real-time data first, then backfill historical if needed
    return this.syncSymbolsWithQuote(symbols);
  }

  /**
   * Sync using Yahoo Finance quote() for real-time: current price, 52w high, 52w low.
   * Also backfills historical data for new symbols.
   */
  private readonly DATA_RETENTION_DAYS = 14; // Store only last 2 weeks

  private async syncSymbolsWithQuote(symbols: string[]): Promise<SyncResultDto> {
    const symbolsSynced: string[] = [];
    const symbolsFailed: string[] = [];
    const errors: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Remove data older than 2 weeks
    await this.deleteOldPriceData();

    for (const symbol of symbols) {
      try {
        const upperSymbol = symbol.toUpperCase();

        // 1. Fetch real-time quote (current price, 52w high/low, volume, etc.)
        await this.fetchAndStoreFromQuote(upperSymbol, today);
        symbolsSynced.push(upperSymbol);

        // 2. Backfill historical data if we don't have enough
        const existingCount = await this.prisma.priceDaily.count({
          where: { symbol: upperSymbol },
        });
        if (existingCount < 5) {
          await this.fetchAndStoreHistoricalData(upperSymbol);
        }
      } catch (error) {
        this.logger.error(`Failed to sync ${symbol}: ${error.message}`);
        symbolsFailed.push(symbol.toUpperCase());
        errors.push(`${symbol}: ${error.message}`);
      }
    }

    return {
      success: symbolsFailed.length === 0,
      symbolsSynced,
      symbolsFailed,
      lastSyncDate: today,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Fetch from Yahoo quote() and store: current price, 52-week high, 52-week low, volume.
   */
  private async fetchAndStoreFromQuote(symbol: string, date: Date): Promise<void> {
    let attempts = 0;
    let quote: any = null;

    while (attempts < this.retryAttempts) {
      try {
        quote = await this.yahooFinance.quote(symbol);
        break;
      } catch (error) {
        attempts++;
        this.logger.warn(
          `Quote attempt ${attempts}/${this.retryAttempts} failed for ${symbol}: ${error.message}`,
        );
        if (attempts < this.retryAttempts) {
          await this.sleep(this.retryDelay * Math.pow(2, attempts - 1));
        } else {
          throw error;
        }
      }
    }

    if (!quote) {
      throw new Error(`No quote data for ${symbol}`);
    }

    const currentPrice =
      quote.regularMarketPrice ??
      quote.regularMarketPreviousClose ??
      quote.preMarketPrice ??
      quote.postMarketPrice;
    if (currentPrice == null) {
      throw new Error(`No price data for ${symbol}`);
    }

    const fiftyTwoWeekHigh = quote.fiftyTwoWeekHigh ?? currentPrice;
    const fiftyTwoWeekLow = quote.fiftyTwoWeekLow ?? currentPrice;
    const volume = quote.regularMarketVolume ?? quote.volume ?? 0;

    await this.prisma.priceDaily.upsert({
      where: {
        symbol_date: { symbol, date },
      },
      create: {
        symbol,
        date,
        open: currentPrice,
        high: quote.regularMarketDayHigh ?? currentPrice,
        low: quote.regularMarketDayLow ?? currentPrice,
        close: currentPrice,
        volume: volume ? BigInt(Math.floor(volume)) : null,
        fiftyTwoWeekHigh,
        fiftyTwoWeekLow,
      },
      update: {
        open: currentPrice,
        high: quote.regularMarketDayHigh ?? currentPrice,
        low: quote.regularMarketDayLow ?? currentPrice,
        close: currentPrice,
        volume: volume ? BigInt(Math.floor(volume)) : null,
        fiftyTwoWeekHigh,
        fiftyTwoWeekLow,
      },
    });

    this.logger.log(
      `Stored quote for ${symbol}: $${currentPrice} | 52w: $${fiftyTwoWeekHigh} / $${fiftyTwoWeekLow}`,
    );
  }

  async syncPortfolioSymbols(portfolioId: string): Promise<SyncResultDto> {
    // Prefer core stocks (portfolio watchlist); fallback to allocations
    const coreStocks = await this.prisma.coreStock.findMany({
      where: { portfolioId },
      select: { symbol: true },
    });

    const symbols =
      coreStocks.length > 0
        ? coreStocks.map((s) => s.symbol)
        : (
            await this.prisma.allocation.findMany({
              where: { portfolioId, isActive: true },
              select: { symbol: true },
            })
          ).map((a) => a.symbol);

    return this.syncSymbols(symbols);
  }

  /**
   * Sync market data for core stocks using Yahoo Finance quote API.
   * Fetches real-time: current price, 52-week high, 52-week low, volume, etc.
   */
  async syncCoreStocks(portfolioId: string): Promise<SyncResultDto> {
    const coreStocks = await this.prisma.coreStock.findMany({
      where: { portfolioId },
      select: { symbol: true },
    });

    const symbols = coreStocks.map((s) => s.symbol);
    if (symbols.length === 0) {
      return {
        success: true,
        symbolsSynced: [],
        symbolsFailed: [],
        lastSyncDate: new Date(),
        errors: ['No core stocks found for this portfolio'],
      };
    }

    return this.syncSymbolsWithQuote(symbols);
  }

  async getLatestPrice(symbol: string): Promise<PriceDailyDto | null> {
    const price = await this.prisma.priceDaily.findFirst({
      where: { symbol: symbol.toUpperCase() },
      orderBy: { date: 'desc' },
    });

    if (!price) return null;

    return this.mapToDto(price);
  }

  async getPriceHistory(
    symbol: string,
    days: number = 365,
  ): Promise<PriceDailyDto[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const prices = await this.prisma.priceDaily.findMany({
      where: {
        symbol: symbol.toUpperCase(),
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    return prices.map((p) => this.mapToDto(p));
  }

  async getMarketDataSummary(symbol: string): Promise<MarketDataSummaryDto | null> {
    const upperSymbol = symbol.toUpperCase();

    // Get latest price
    const latest = await this.prisma.priceDaily.findFirst({
      where: { symbol: upperSymbol },
      orderBy: { date: 'desc' },
    });

    if (!latest) return null;

    // Get previous day for change calculation
    const previous = await this.prisma.priceDaily.findFirst({
      where: {
        symbol: upperSymbol,
        date: { lt: latest.date },
      },
      orderBy: { date: 'desc' },
    });

    const latestClose = Number(latest.close);
    const previousClose = previous ? Number(previous.close) : latestClose;
    const change24h = latestClose - previousClose;
    const changePercent24h = previousClose > 0 
      ? (change24h / previousClose) * 100 
      : 0;

    const fiftyTwoWeekHigh = Number(latest.fiftyTwoWeekHigh) || latestClose;
    const fiftyTwoWeekLow = Number(latest.fiftyTwoWeekLow) || latestClose;
    const dipFromHigh = fiftyTwoWeekHigh > 0
      ? ((fiftyTwoWeekHigh - latestClose) / fiftyTwoWeekHigh) * 100
      : 0;

    return {
      symbol: upperSymbol,
      latestPrice: latestClose,
      latestDate: latest.date,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      dipFromHigh,
      change24h,
      changePercent24h,
    };
  }

  async getMultipleMarketDataSummaries(
    symbols: string[],
  ): Promise<MarketDataSummaryDto[]> {
    const summaries: MarketDataSummaryDto[] = [];

    for (const symbol of symbols) {
      const summary = await this.getMarketDataSummary(symbol);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  }

  /**
   * Get market data for all core stocks in a portfolio.
   */
  async getCoreStocksMarketData(
    portfolioId: string,
  ): Promise<MarketDataSummaryDto[]> {
    const coreStocks = await this.prisma.coreStock.findMany({
      where: { portfolioId },
      select: { symbol: true },
    });

    const symbols = coreStocks.map((s) => s.symbol);
    return this.getMultipleMarketDataSummaries(symbols);
  }

  private async deleteOldPriceData(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.DATA_RETENTION_DAYS);
    cutoffDate.setHours(0, 0, 0, 0);

    const result = await this.prisma.priceDaily.deleteMany({
      where: { date: { lt: cutoffDate } },
    });

    if (result.count > 0) {
      this.logger.log(`Deleted ${result.count} price records older than ${this.DATA_RETENTION_DAYS} days`);
    }
  }

  private async fetchAndStoreHistoricalData(symbol: string): Promise<void> {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - this.DATA_RETENTION_DAYS);

    let attempts = 0;
    let historicalData: any[] = [];

    while (attempts < this.retryAttempts) {
      try {
        const result = await this.yahooFinance.chart(symbol, {
          period1: twoWeeksAgo,
          period2: new Date(),
          interval: '1d',
        }) as any;

        if (result && result.quotes) {
          historicalData = result.quotes;
        }
        break;
      } catch (error) {
        attempts++;
        this.logger.warn(
          `Attempt ${attempts}/${this.retryAttempts} failed for ${symbol}: ${error.message}`,
        );

        if (attempts < this.retryAttempts) {
          await this.sleep(this.retryDelay * Math.pow(2, attempts - 1));
        } else {
          throw error;
        }
      }
    }

    if (historicalData.length === 0) {
      throw new Error(`No historical data found for ${symbol}`);
    }

    // Keep only last 2 weeks
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.DATA_RETENTION_DAYS);
    cutoffDate.setHours(0, 0, 0, 0);
    historicalData = historicalData.filter(
      (d) => d.date && new Date(d.date) >= cutoffDate,
    );

    // Calculate 52-week high and low from available data (for this symbol's range)
    const closes = historicalData
      .filter((d) => d.close !== null && d.close !== undefined)
      .map((d) => d.close);

    const highs = historicalData
      .filter((d) => d.high !== null && d.high !== undefined)
      .map((d) => d.high);

    const lows = historicalData
      .filter((d) => d.low !== null && d.low !== undefined)
      .map((d) => d.low);

    const fiftyTwoWeekHigh = highs.length > 0 ? Math.max(...highs) : null;
    const fiftyTwoWeekLow = lows.length > 0 ? Math.min(...lows) : null;

    // Store all historical data points
    for (const data of historicalData) {
      if (!data.date || data.close === null || data.close === undefined) continue;

      const date = new Date(data.date);
      date.setHours(0, 0, 0, 0);

      try {
        await this.prisma.priceDaily.upsert({
          where: {
            symbol_date: { symbol, date },
          },
          create: {
            symbol,
            date,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume ? BigInt(Math.floor(data.volume)) : null,
            fiftyTwoWeekHigh,
            fiftyTwoWeekLow,
          },
          update: {
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume ? BigInt(Math.floor(data.volume)) : null,
            fiftyTwoWeekHigh,
            fiftyTwoWeekLow,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to store price for ${symbol} on ${date.toISOString()}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Stored ${historicalData.length} data points for ${symbol}`,
    );
  }

  private getPreviousUSTradingDay(): Date {
    const now = new Date();
    const estOffset = -5; // EST offset from UTC
    const utcHour = now.getUTCHours();
    const estHour = utcHour + estOffset;

    // Start from today
    let date = new Date(now);
    date.setHours(0, 0, 0, 0);

    // If it's before market close (4 PM EST), go back one more day
    if (estHour < 16) {
      date.setDate(date.getDate() - 1);
    }

    // Skip weekends
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) {
      // Sunday
      date.setDate(date.getDate() - 2);
    } else if (dayOfWeek === 6) {
      // Saturday
      date.setDate(date.getDate() - 1);
    }

    // Note: This doesn't account for US market holidays
    // In production, you'd want a proper holiday calendar

    return date;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private mapToDto(price: any): PriceDailyDto {
    return {
      id: price.id,
      symbol: price.symbol,
      date: price.date,
      open: price.open ? Number(price.open) : null,
      high: price.high ? Number(price.high) : null,
      low: price.low ? Number(price.low) : null,
      close: Number(price.close),
      volume: price.volume ? Number(price.volume) : null,
      fiftyTwoWeekHigh: price.fiftyTwoWeekHigh
        ? Number(price.fiftyTwoWeekHigh)
        : null,
      fiftyTwoWeekLow: price.fiftyTwoWeekLow
        ? Number(price.fiftyTwoWeekLow)
        : null,
    };
  }
}
