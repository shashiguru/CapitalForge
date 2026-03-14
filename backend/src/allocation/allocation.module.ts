import { Module } from '@nestjs/common';
import { AllocationController, AllocationItemController } from './allocation.controller';
import { AllocationService } from './allocation.service';
import { PortfolioModule } from '../portfolio/portfolio.module';

@Module({
  imports: [PortfolioModule],
  controllers: [AllocationController, AllocationItemController],
  providers: [AllocationService],
  exports: [AllocationService],
})
export class AllocationModule {}
