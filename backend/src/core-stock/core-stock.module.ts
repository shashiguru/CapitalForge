import { Module } from '@nestjs/common';
import { CoreStockService } from './core-stock.service';
import { CoreStockController } from './core-stock.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PortfolioModule } from '../portfolio/portfolio.module';

@Module({
  imports: [PrismaModule, PortfolioModule],
  controllers: [CoreStockController],
  providers: [CoreStockService],
  exports: [CoreStockService],
})
export class CoreStockModule {}
