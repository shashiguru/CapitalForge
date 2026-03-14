import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioService } from '../portfolio/portfolio.service';

@Injectable()
export class CoreStockService {
  constructor(
    private prisma: PrismaService,
    private portfolioService: PortfolioService,
  ) {}

  async findAll(portfolioId: string, userId: string): Promise<{ symbol: string; displayName: string | null }[]> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const coreStocks = await this.prisma.coreStock.findMany({
      where: { portfolioId },
      orderBy: { symbol: 'asc' },
      select: { symbol: true, displayName: true },
    });

    if (coreStocks.length === 0) {
      await this.syncFromAllocations(portfolioId, userId);
      return this.findAll(portfolioId, userId);
    }

    return coreStocks.map((s) => ({
      symbol: s.symbol,
      displayName: s.displayName,
    }));
  }

  async syncFromAllocations(portfolioId: string, userId: string): Promise<{ symbol: string }[]> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const allocations = await this.prisma.allocation.findMany({
      where: { portfolioId, isActive: true },
      select: { symbol: true, companyName: true },
    });

    const created: { symbol: string }[] = [];
    for (const a of allocations) {
      await this.prisma.coreStock.upsert({
        where: {
          portfolioId_symbol: { portfolioId, symbol: a.symbol },
        },
        create: {
          portfolioId,
          symbol: a.symbol,
          displayName: a.companyName,
        },
        update: {},
      });
      created.push({ symbol: a.symbol });
    }

    return created;
  }

  async add(portfolioId: string, userId: string, symbol: string, displayName?: string): Promise<void> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    await this.prisma.coreStock.upsert({
      where: {
        portfolioId_symbol: { portfolioId, symbol: symbol.toUpperCase() },
      },
      create: {
        portfolioId,
        symbol: symbol.toUpperCase(),
        displayName: displayName || null,
      },
      update: displayName !== undefined ? { displayName } : {},
    });
  }
}
