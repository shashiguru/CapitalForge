import { Module } from '@nestjs/common';
import { StrategyController, BuyPlanController } from './strategy.controller';
import { StrategyService } from './strategy.service';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [PortfolioModule, MarketDataModule],
  controllers: [StrategyController, BuyPlanController],
  providers: [StrategyService],
  exports: [StrategyService],
})
export class StrategyModule {}
