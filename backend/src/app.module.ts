import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
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
import { AuthBypassMiddleware } from './common/middleware/auth-bypass.middleware';

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
    AuthBypassMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthBypassMiddleware).forRoutes('*');
  }
}
