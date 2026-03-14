import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePortfolioDto,
  UpdatePortfolioDto,
  PortfolioResponseDto,
  PortfolioSummaryDto,
} from './dto/portfolio.dto';
import {
  CreateBudgetPresetDto,
  UpdateBudgetPresetDto,
  BudgetPresetResponseDto,
} from './dto/budget-preset.dto';

@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreatePortfolioDto,
  ): Promise<PortfolioResponseDto> {
    const portfolio = await this.prisma.portfolio.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        totalCapital: dto.totalCapital || 0,
        strategyReferenceBudget: dto.strategyReferenceBudget ?? undefined,
        currency: dto.currency || 'USD',
      },
    });

    return this.mapToResponse(portfolio);
  }

  async findAll(userId: string): Promise<PortfolioResponseDto[]> {
    const portfolios = await this.prisma.portfolio.findMany({
      where: { userId, isActive: true },
      include: {
        _count: {
          select: {
            allocations: true,
            transactions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return portfolios.map((p) => ({
      ...this.mapToResponse(p),
      allocationsCount: p._count.allocations,
      transactionsCount: p._count.transactions,
    }));
  }

  async findOne(id: string, userId: string): Promise<PortfolioResponseDto> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            allocations: true,
            transactions: true,
          },
        },
      },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    if (portfolio.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return {
      ...this.mapToResponse(portfolio),
      allocationsCount: portfolio._count.allocations,
      transactionsCount: portfolio._count.transactions,
    };
  }

  async update(
    id: string,
    userId: string,
    dto: UpdatePortfolioDto,
  ): Promise<PortfolioResponseDto> {
    await this.validateOwnership(id, userId);

    const portfolio = await this.prisma.portfolio.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.totalCapital !== undefined && { totalCapital: dto.totalCapital }),
        ...(dto.strategyReferenceBudget !== undefined && { strategyReferenceBudget: dto.strategyReferenceBudget }),
        ...(dto.budgetYearStart !== undefined && { budgetYearStart: dto.budgetYearStart ? new Date(dto.budgetYearStart) : null }),
        ...(dto.budgetYearEnd !== undefined && { budgetYearEnd: dto.budgetYearEnd ? new Date(dto.budgetYearEnd) : null }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return this.mapToResponse(portfolio);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.validateOwnership(id, userId);

    // Soft delete - set isActive to false
    await this.prisma.portfolio.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getBudgetPresets(portfolioId: string, userId: string): Promise<BudgetPresetResponseDto[]> {
    await this.validateOwnership(portfolioId, userId);
    const presets = await this.prisma.budgetPreset.findMany({
      where: { portfolioId },
      orderBy: { createdAt: 'desc' },
    });
    return presets.map((p) => this.mapPresetToResponse(p));
  }

  async createBudgetPreset(
    portfolioId: string,
    userId: string,
    dto: CreateBudgetPresetDto,
  ): Promise<BudgetPresetResponseDto> {
    await this.validateOwnership(portfolioId, userId);
    const preset = await this.prisma.budgetPreset.create({
      data: {
        portfolioId,
        name: dto.name,
        totalCapital: dto.totalCapital,
        strategyReferenceBudget: dto.strategyReferenceBudget ?? undefined,
        budgetYearStart: dto.budgetYearStart ? new Date(dto.budgetYearStart) : undefined,
        budgetYearEnd: dto.budgetYearEnd ? new Date(dto.budgetYearEnd) : undefined,
      },
    });
    return this.mapPresetToResponse(preset);
  }

  async updateBudgetPreset(
    portfolioId: string,
    presetId: string,
    userId: string,
    dto: UpdateBudgetPresetDto,
  ): Promise<BudgetPresetResponseDto> {
    await this.validateOwnership(portfolioId, userId);
    const preset = await this.prisma.budgetPreset.findFirst({
      where: { id: presetId, portfolioId },
    });
    if (!preset) {
      throw new NotFoundException('Budget preset not found');
    }
    const updateData: Record<string, unknown> = {};
    if (dto.name != null && dto.name !== '') updateData.name = dto.name;
    if (dto.totalCapital != null && !Number.isNaN(dto.totalCapital)) updateData.totalCapital = dto.totalCapital;
    if (dto.strategyReferenceBudget != null && !Number.isNaN(dto.strategyReferenceBudget)) updateData.strategyReferenceBudget = dto.strategyReferenceBudget;
    if (dto.budgetYearStart != null && dto.budgetYearStart !== '') {
      const startDate = new Date(dto.budgetYearStart);
      if (!Number.isNaN(startDate.getTime())) updateData.budgetYearStart = startDate;
    }
    if (dto.budgetYearEnd != null && dto.budgetYearEnd !== '') {
      const endDate = new Date(dto.budgetYearEnd);
      if (!Number.isNaN(endDate.getTime())) updateData.budgetYearEnd = endDate;
    }
    if (Object.keys(updateData).length === 0) {
      return this.mapPresetToResponse(preset);
    }
    const updated = await this.prisma.budgetPreset.update({
      where: { id: presetId },
      data: updateData as any,
    });
    return this.mapPresetToResponse(updated);
  }

  async applyBudgetPreset(
    portfolioId: string,
    presetId: string,
    userId: string,
  ): Promise<PortfolioResponseDto> {
    await this.validateOwnership(portfolioId, userId);
    const preset = await this.prisma.budgetPreset.findFirst({
      where: { id: presetId, portfolioId },
    });
    if (!preset) {
      throw new NotFoundException('Budget preset not found');
    }
    // Apply preset: update budget and period only. Keep strategyReferenceBudget - it's the
    // budget the strategy rules were designed for (e.g. $23,639) and must not change when
    // switching budgets, so scaling (totalCapital/strategyReferenceBudget) works correctly.
    const portfolio = await this.prisma.portfolio.update({
      where: { id: portfolioId },
      data: {
        totalCapital: preset.totalCapital,
        budgetYearStart: preset.budgetYearStart,
        budgetYearEnd: preset.budgetYearEnd,
      },
    });
    return this.mapToResponse(portfolio);
  }

  async deleteBudgetPreset(
    portfolioId: string,
    presetId: string,
    userId: string,
  ): Promise<void> {
    await this.validateOwnership(portfolioId, userId);
    const preset = await this.prisma.budgetPreset.findFirst({
      where: { id: presetId, portfolioId },
    });
    if (!preset) {
      throw new NotFoundException('Budget preset not found');
    }
    await this.prisma.budgetPreset.delete({ where: { id: presetId } });
  }

  private mapPresetToResponse(preset: any): BudgetPresetResponseDto {
    const toDateStr = (d: Date | null) => (d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : null);
    return {
      id: preset.id,
      portfolioId: preset.portfolioId,
      name: preset.name,
      totalCapital: Number(preset.totalCapital),
      strategyReferenceBudget: preset.strategyReferenceBudget != null ? Number(preset.strategyReferenceBudget) : null,
      budgetYearStart: toDateStr(preset.budgetYearStart),
      budgetYearEnd: toDateStr(preset.budgetYearEnd),
      createdAt: preset.createdAt,
    };
  }

  async getSummary(id: string, userId: string): Promise<PortfolioSummaryDto> {
    await this.validateOwnership(id, userId);

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id },
      include: {
        allocations: {
          where: { isActive: true },
        },
        transactions: {
          where: { type: 'BUY' },
        },
      },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    // Calculate totals
    const totalAllocated = portfolio.allocations.reduce(
      (sum, a) => sum + Number(a.allocationUSD),
      0,
    );

    const totalInvested = portfolio.transactions.reduce(
      (sum, t) => sum + Number(t.total),
      0,
    );

    // Get current prices and calculate value
    const symbols = portfolio.allocations.map((a) => a.symbol);
    const latestPrices = await this.getLatestPrices(symbols);

    let currentValue = 0;
    for (const allocation of portfolio.allocations) {
      const price = latestPrices.get(allocation.symbol) || 0;
      currentValue += Number(allocation.sharesOwned) * price;
    }

    const unrealizedPnL = currentValue - totalInvested;
    const unrealizedPnLPercent =
      totalInvested > 0 ? (unrealizedPnL / totalInvested) * 100 : 0;

    return {
      id: portfolio.id,
      name: portfolio.name,
      totalCapital: Number(portfolio.totalCapital),
      currency: portfolio.currency,
      totalAllocated,
      totalInvested,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPercent,
      allocationsCount: portfolio.allocations.length,
    };
  }

  async validateOwnership(portfolioId: string, userId: string): Promise<void> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: { userId: true },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    if (portfolio.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async getLatestPrices(symbols: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();

    if (symbols.length === 0) return priceMap;

    const prices = await this.prisma.priceDaily.findMany({
      where: {
        symbol: { in: symbols },
      },
      orderBy: { date: 'desc' },
      distinct: ['symbol'],
    });

    prices.forEach((p) => {
      priceMap.set(p.symbol, Number(p.close));
    });

    return priceMap;
  }

  private mapToResponse(portfolio: any): PortfolioResponseDto {
    const toDateStr = (d: Date | null) => (d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : null);
    return {
      id: portfolio.id,
      userId: portfolio.userId,
      name: portfolio.name,
      description: portfolio.description,
      totalCapital: Number(portfolio.totalCapital),
      strategyReferenceBudget: portfolio.strategyReferenceBudget != null ? Number(portfolio.strategyReferenceBudget) : null,
      budgetYearStart: toDateStr(portfolio.budgetYearStart),
      budgetYearEnd: toDateStr(portfolio.budgetYearEnd),
      currency: portfolio.currency,
      isActive: portfolio.isActive,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
    };
  }
}
