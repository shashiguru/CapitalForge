import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CoreStockService } from './core-stock.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('portfolios/:portfolioId/core-stocks')
export class CoreStockController {
  constructor(private readonly coreStockService: CoreStockService) {}

  @Get()
  async findAll(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<{ symbol: string; displayName: string | null }[]> {
    return this.coreStockService.findAll(portfolioId, userId);
  }

  @Post('sync')
  async syncFromAllocations(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<{ symbol: string }[]> {
    return this.coreStockService.syncFromAllocations(portfolioId, userId);
  }

  @Post()
  async add(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { symbol: string; displayName?: string },
  ): Promise<void> {
    return this.coreStockService.add(portfolioId, userId, body.symbol, body.displayName);
  }
}
