import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { AllocationModule } from './allocation/allocation.module';
import { MarketDataModule } from './market-data/market-data.module';
import { StrategyModule } from './strategy/strategy.module';
import { BudgetModule } from './budget/budget.module';
import { TransactionModule } from './transaction/transaction.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CoreStockModule } from './core-stock/core-stock.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    PortfolioModule,
    AllocationModule,
    MarketDataModule,
    StrategyModule,
    BudgetModule,
    TransactionModule,
    AnalyticsModule,
    CoreStockModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
