import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [PortfolioModule, MarketDataModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
