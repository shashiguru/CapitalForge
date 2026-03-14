import { Module } from '@nestjs/common';
import { BudgetController, BudgetItemController } from './budget.controller';
import { BudgetService } from './budget.service';
import { PortfolioModule } from '../portfolio/portfolio.module';

@Module({
  imports: [PortfolioModule],
  controllers: [BudgetController, BudgetItemController],
  providers: [BudgetService],
  exports: [BudgetService],
})
export class BudgetModule {}
