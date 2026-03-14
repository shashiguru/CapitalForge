import { Module } from '@nestjs/common';
import { TransactionController, TransactionItemController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { AllocationModule } from '../allocation/allocation.module';
import { BudgetModule } from '../budget/budget.module';

@Module({
  imports: [PortfolioModule, AllocationModule, BudgetModule],
  controllers: [TransactionController, TransactionItemController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
