import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import {
  PortfolioAnalyticsDto,
  AllocationChartDataDto,
  BucketUsageDto,
  DipOpportunityDto,
  PerformanceAnalyticsDto,
  AllocationRebalanceDto,
} from './dto/analytics.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('portfolios/:portfolioId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async getPortfolioAnalytics(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<PortfolioAnalyticsDto> {
    return this.analyticsService.getPortfolioAnalytics(portfolioId, userId);
  }

  @Get('allocation-chart')
  async getAllocationChartData(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<AllocationChartDataDto[]> {
    return this.analyticsService.getAllocationChartData(portfolioId, userId);
  }

  @Get('bucket-usage')
  async getBucketUsage(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<BucketUsageDto[]> {
    return this.analyticsService.getBucketUsage(portfolioId, userId);
  }

  @Get('dip-opportunities')
  async getDipOpportunities(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<DipOpportunityDto[]> {
    return this.analyticsService.getDipOpportunities(portfolioId, userId);
  }

  @Get('weekly-transactions')
  async getWeeklyTransactions(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
    @Query('weeks') weeks?: string,
  ) {
    return this.analyticsService.getWeeklyTransactions(
      portfolioId,
      userId,
      weeks ? parseInt(weeks, 10) : 12,
    );
  }

  @Get('timeseries')
  async getPortfolioTimeseries(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
    @Query('days') days?: string,
  ) {
    return this.analyticsService.getPortfolioTimeseries(
      portfolioId,
      userId,
      days ? parseInt(days, 10) : 90,
    );
  }

  @Get('performance')
  async getPerformanceAnalytics(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
    @Query('days') days?: string,
  ): Promise<PerformanceAnalyticsDto> {
    return this.analyticsService.getPerformanceAnalytics(
      portfolioId,
      userId,
      days ? parseInt(days, 10) : 30,
    );
  }

  @Get('allocation-rebalance')
  async getAllocationRebalance(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<AllocationRebalanceDto> {
    return this.analyticsService.getAllocationRebalance(portfolioId, userId) as Promise<AllocationRebalanceDto>;
  }
}
