import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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
import {
  SaveBudgetPresetCompositionDto,
  BudgetPresetStockResponseDto,
} from './dto/budget-preset-composition.dto';

@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreatePortfolioDto): Promise<PortfolioResponseDto> {
    const portfolio = await this.prisma.portfolio.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        totalCapital: dto.totalCapital || 0,
        currency: dto.currency || 'USD',
        ...(dto.coreRatio !== undefined && { coreRatio: dto.coreRatio }),
        ...(dto.dipRatio !== undefined && { dipRatio: dto.dipRatio }),
        ...(dto.crashRatio !== undefined && { crashRatio: dto.crashRatio }),
        ...(dto.dcaWeeksPerYear !== undefined && { dcaWeeksPerYear: dto.dcaWeeksPerYear }),
      },
    });

    return this.mapToResponse(portfolio);
  }

  async findAll(userId: string): Promise<PortfolioResponseDto[]> {
    const portfolios = await this.prisma.portfolio.findMany({
      where: { userId, isActive: true },
      include: {
        _count: { select: { allocations: true, transactions: true } },
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
        _count: { select: { allocations: true, transactions: true } },
      },
    });

    if (!portfolio) throw new NotFoundException('Portfolio not found');
    if (portfolio.userId !== userId) throw new ForbiddenException('Access denied');

    return {
      ...this.mapToResponse(portfolio),
      allocationsCount: portfolio._count.allocations,
      transactionsCount: portfolio._count.transactions,
    };
  }

  async update(id: string, userId: string, dto: UpdatePortfolioDto): Promise<PortfolioResponseDto> {
    await this.validateOwnership(id, userId);

    // Validate ratios sum to 1.0 if any are provided
    if (
      dto.coreRatio !== undefined ||
      dto.dipRatio !== undefined ||
      dto.crashRatio !== undefined
    ) {
      const current = await this.prisma.portfolio.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Portfolio not found');
      const core = dto.coreRatio ?? Number(current.coreRatio);
      const dip = dto.dipRatio ?? Number(current.dipRatio);
      const crash = dto.crashRatio ?? Number(current.crashRatio);
      const sum = core + dip + crash;
      if (Math.abs(sum - 1.0) > 0.001) {
        throw new BadRequestException(
          `Bucket ratios must sum to 1.0 (got ${sum.toFixed(4)})`,
        );
      }
    }

    const portfolio = await this.prisma.portfolio.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.totalCapital !== undefined && { totalCapital: dto.totalCapital }),
        ...(dto.budgetYearStart !== undefined && {
          budgetYearStart: dto.budgetYearStart ? new Date(dto.budgetYearStart) : null,
        }),
        ...(dto.budgetYearEnd !== undefined && {
          budgetYearEnd: dto.budgetYearEnd ? new Date(dto.budgetYearEnd) : null,
        }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.coreRatio !== undefined && { coreRatio: dto.coreRatio }),
        ...(dto.dipRatio !== undefined && { dipRatio: dto.dipRatio }),
        ...(dto.crashRatio !== undefined && { crashRatio: dto.crashRatio }),
        ...(dto.dcaWeeksPerYear !== undefined && { dcaWeeksPerYear: dto.dcaWeeksPerYear }),
      },
    });

    // If anything that affects bucket calculations changed, recalculate
    const shouldRecalc =
      dto.totalCapital !== undefined ||
      dto.coreRatio !== undefined ||
      dto.dipRatio !== undefined ||
      dto.crashRatio !== undefined ||
      dto.dcaWeeksPerYear !== undefined;

    if (shouldRecalc) {
      await this.recalculateBuckets(id);
    }

    return this.mapToResponse(portfolio);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.validateOwnership(id, userId);
    await this.prisma.portfolio.update({ where: { id }, data: { isActive: false } });
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
        budgetYearStart: dto.budgetYearStart ? new Date(dto.budgetYearStart) : undefined,
        budgetYearEnd: dto.budgetYearEnd ? new Date(dto.budgetYearEnd) : undefined,
      },
    });

    await this.copyActiveAllocationsToPreset(portfolioId, preset.id);

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
    if (!preset) throw new NotFoundException('Budget preset not found');

    const updateData: Record<string, unknown> = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.totalCapital != null) updateData.totalCapital = dto.totalCapital;
    if (dto.budgetYearStart) {
      const d = new Date(dto.budgetYearStart);
      if (!isNaN(d.getTime())) updateData.budgetYearStart = d;
    }
    if (dto.budgetYearEnd) {
      const d = new Date(dto.budgetYearEnd);
      if (!isNaN(d.getTime())) updateData.budgetYearEnd = d;
    }

    if (Object.keys(updateData).length === 0) return this.mapPresetToResponse(preset);

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
    if (!preset) throw new NotFoundException('Budget preset not found');

    const portfolio = await this.prisma.portfolio.update({
      where: { id: portfolioId },
      data: {
        totalCapital: preset.totalCapital,
        budgetYearStart: preset.budgetYearStart,
        budgetYearEnd: preset.budgetYearEnd,
      },
    });

    await this.syncAllocationsFromPreset(portfolioId, presetId);
    await this.recalculateBuckets(portfolioId);

    return this.mapToResponse(portfolio);
  }

  async getBudgetPresetComposition(
    portfolioId: string,
    presetId: string,
    userId: string,
  ): Promise<BudgetPresetStockResponseDto[]> {
    await this.validateOwnership(portfolioId, userId);
    await this.ensurePresetExists(portfolioId, presetId);

    const stocks = await this.prisma.budgetPresetStock.findMany({
      where: { budgetPresetId: presetId },
      orderBy: [{ sortOrder: 'asc' }, { symbol: 'asc' }],
    });

    return stocks.map((s) => this.mapPresetStockToResponse(s));
  }

  async saveBudgetPresetComposition(
    portfolioId: string,
    presetId: string,
    userId: string,
    dto: SaveBudgetPresetCompositionDto,
  ): Promise<BudgetPresetStockResponseDto[]> {
    await this.validateOwnership(portfolioId, userId);
    await this.ensurePresetExists(portfolioId, presetId);

    const symbols = dto.stocks.map((s) => s.symbol.toUpperCase());
    if (new Set(symbols).size !== symbols.length) {
      throw new BadRequestException('Duplicate symbols are not allowed');
    }

    const totalPct = dto.stocks.reduce((sum, s) => sum + s.targetPercentage, 0);
    if (totalPct > 100.05) {
      throw new BadRequestException(
        `Total target percentage is ${totalPct.toFixed(1)}% — must be ≤ 100%`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.budgetPresetStock.deleteMany({ where: { budgetPresetId: presetId } });
      if (dto.stocks.length > 0) {
        await tx.budgetPresetStock.createMany({
          data: dto.stocks.map((stock, index) => ({
            budgetPresetId: presetId,
            symbol: stock.symbol.toUpperCase(),
            companyName: stock.companyName ?? null,
            targetPercentage: stock.targetPercentage,
            isAggressive: stock.isAggressive ?? false,
            fiftyTwoWeekHigh: stock.fiftyTwoWeekHigh ?? null,
            sortOrder: index,
          })),
        });
      }
    });

    return this.getBudgetPresetComposition(portfolioId, presetId, userId);
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
    if (!preset) throw new NotFoundException('Budget preset not found');
    await this.prisma.budgetPreset.delete({ where: { id: presetId } });
  }

  async getSummary(id: string, userId: string): Promise<PortfolioSummaryDto> {
    await this.validateOwnership(id, userId);

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id },
      include: {
        allocations: { where: { isActive: true } },
        transactions: { where: { type: 'BUY' } },
      },
    });

    if (!portfolio) throw new NotFoundException('Portfolio not found');

    const totalAllocated = portfolio.allocations.reduce(
      (sum, a) => sum + Number(a.allocationUSD),
      0,
    );

    const totalInvested = portfolio.transactions.reduce(
      (sum, t) => sum + Number(t.total),
      0,
    );

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

  /** Recalculate allocation bucket sizes based on current portfolio ratios/capital.
   *  Called whenever totalCapital, coreRatio, dipRatio, crashRatio, or dcaWeeksPerYear changes.
   */
  async recalculateBuckets(portfolioId: string): Promise<void> {
    const portfolio = await this.prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio) return;

    const totalCapital = Number(portfolio.totalCapital);
    const coreRatio = Number(portfolio.coreRatio);
    const dipRatio = Number(portfolio.dipRatio);
    const crashRatio = Number(portfolio.crashRatio);
    const dcaWeeksPerYear = portfolio.dcaWeeksPerYear;

    const allocations = await this.prisma.allocation.findMany({
      where: { portfolioId, isActive: true },
    });

    for (const a of allocations) {
      const allocationUSD = (totalCapital * Number(a.targetPercentage)) / 100;
      const coreBucketUSD = allocationUSD * coreRatio;
      const dipBucketUSD = allocationUSD * dipRatio;
      const crashBucketUSD = allocationUSD * crashRatio;
      const monthlyDCA = coreBucketUSD / 12;
      const weeklyDCA = coreBucketUSD / dcaWeeksPerYear;
      const coreUsed = Number(a.coreUsedUSD);
      const dipUsed = Number(a.dipUsedUSD);
      const crashUsed = Number(a.crashUsedUSD);

      await this.prisma.allocation.update({
        where: { id: a.id },
        data: {
          allocationUSD,
          coreBucketUSD,
          dipBucketUSD,
          crashBucketUSD,
          monthlyDCA,
          weeklyDCA,
          coreRemainingUSD: Math.max(0, coreBucketUSD - coreUsed),
          dipRemainingUSD: Math.max(0, dipBucketUSD - dipUsed),
          crashRemainingUSD: Math.max(0, crashBucketUSD - crashUsed),
        },
      });
    }
  }

  async validateOwnership(portfolioId: string, userId: string): Promise<void> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: { userId: true },
    });

    if (!portfolio) throw new NotFoundException('Portfolio not found');
    if (portfolio.userId !== userId) throw new ForbiddenException('Access denied');
  }

  private async getLatestPrices(symbols: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    if (symbols.length === 0) return priceMap;

    const prices = await this.prisma.priceDaily.findMany({
      where: { symbol: { in: symbols } },
      orderBy: { date: 'desc' },
      distinct: ['symbol'],
    });

    prices.forEach((p) => priceMap.set(p.symbol, Number(p.close)));
    return priceMap;
  }

  private async ensurePresetExists(portfolioId: string, presetId: string) {
    const preset = await this.prisma.budgetPreset.findFirst({
      where: { id: presetId, portfolioId },
    });
    if (!preset) throw new NotFoundException('Budget preset not found');
    return preset;
  }

  private async copyActiveAllocationsToPreset(
    portfolioId: string,
    presetId: string,
  ): Promise<void> {
    const allocations = await this.prisma.allocation.findMany({
      where: { portfolioId, isActive: true },
      orderBy: { symbol: 'asc' },
    });

    if (allocations.length === 0) return;

    await this.prisma.budgetPresetStock.createMany({
      data: allocations.map((a, index) => ({
        budgetPresetId: presetId,
        symbol: a.symbol,
        companyName: a.companyName,
        targetPercentage: a.targetPercentage,
        isAggressive: a.isAggressive,
        fiftyTwoWeekHigh: a.fiftyTwoWeekHigh,
        sortOrder: index,
      })),
    });
  }

  /** Apply a preset's stock list to live portfolio allocations (strategy targets). */
  private async syncAllocationsFromPreset(
    portfolioId: string,
    presetId: string,
  ): Promise<void> {
    const presetStocks = await this.prisma.budgetPresetStock.findMany({
      where: { budgetPresetId: presetId },
      orderBy: [{ sortOrder: 'asc' }, { symbol: 'asc' }],
    });

    const presetSymbols = new Set(presetStocks.map((s) => s.symbol));
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });
    if (!portfolio) return;

    const totalCapital = Number(portfolio.totalCapital);
    const coreRatio = Number(portfolio.coreRatio);
    const dipRatio = Number(portfolio.dipRatio);
    const crashRatio = Number(portfolio.crashRatio);
    const dcaWeeksPerYear = portfolio.dcaWeeksPerYear;

    const existing = await this.prisma.allocation.findMany({
      where: { portfolioId },
    });

    for (const stock of presetStocks) {
      const targetPercentage = Number(stock.targetPercentage);
      const { allocationUSD, coreBucketUSD, dipBucketUSD, crashBucketUSD, monthlyDCA, weeklyDCA } =
        this.computeAllocationFields(
          totalCapital,
          targetPercentage,
          coreRatio,
          dipRatio,
          crashRatio,
          dcaWeeksPerYear,
        );

      const current = existing.find((a) => a.symbol === stock.symbol);
      if (current) {
        const coreUsed = Number(current.coreUsedUSD);
        const dipUsed = Number(current.dipUsedUSD);
        const crashUsed = Number(current.crashUsedUSD);

        await this.prisma.allocation.update({
          where: { id: current.id },
          data: {
            isActive: true,
            companyName: stock.companyName ?? current.companyName,
            targetPercentage: stock.targetPercentage,
            isAggressive: stock.isAggressive,
            fiftyTwoWeekHigh: stock.fiftyTwoWeekHigh ?? current.fiftyTwoWeekHigh,
            allocationUSD,
            coreBucketUSD,
            dipBucketUSD,
            crashBucketUSD,
            monthlyDCA,
            weeklyDCA,
            coreRemainingUSD: Math.max(0, coreBucketUSD - coreUsed),
            dipRemainingUSD: Math.max(0, dipBucketUSD - dipUsed),
            crashRemainingUSD: Math.max(0, crashBucketUSD - crashUsed),
          },
        });
      } else {
        await this.prisma.allocation.create({
          data: {
            portfolioId,
            symbol: stock.symbol,
            companyName: stock.companyName,
            targetPercentage: stock.targetPercentage,
            isAggressive: stock.isAggressive,
            fiftyTwoWeekHigh: stock.fiftyTwoWeekHigh,
            allocationUSD,
            coreBucketUSD,
            dipBucketUSD,
            crashBucketUSD,
            monthlyDCA,
            weeklyDCA,
            coreRemainingUSD: coreBucketUSD,
            dipRemainingUSD: dipBucketUSD,
            crashRemainingUSD: crashBucketUSD,
            isActive: true,
          },
        });
      }
    }

    for (const allocation of existing) {
      if (!presetSymbols.has(allocation.symbol)) {
        await this.prisma.allocation.update({
          where: { id: allocation.id },
          data: { isActive: false },
        });
      }
    }
  }

  private computeAllocationFields(
    totalCapital: number,
    targetPercentage: number,
    coreRatio: number,
    dipRatio: number,
    crashRatio: number,
    dcaWeeksPerYear: number,
  ) {
    const allocationUSD = (totalCapital * targetPercentage) / 100;
    const coreBucketUSD = allocationUSD * coreRatio;
    const dipBucketUSD = allocationUSD * dipRatio;
    const crashBucketUSD = allocationUSD * crashRatio;
    const monthlyDCA = coreBucketUSD / 12;
    const weeklyDCA = coreBucketUSD / dcaWeeksPerYear;
    return { allocationUSD, coreBucketUSD, dipBucketUSD, crashBucketUSD, monthlyDCA, weeklyDCA };
  }

  private mapPresetStockToResponse(stock: {
    id: string;
    budgetPresetId: string;
    symbol: string;
    companyName: string | null;
    targetPercentage: unknown;
    isAggressive: boolean;
    fiftyTwoWeekHigh: unknown;
    sortOrder: number;
  }): BudgetPresetStockResponseDto {
    return {
      id: stock.id,
      budgetPresetId: stock.budgetPresetId,
      symbol: stock.symbol,
      companyName: stock.companyName,
      targetPercentage: Number(stock.targetPercentage),
      isAggressive: stock.isAggressive,
      fiftyTwoWeekHigh: stock.fiftyTwoWeekHigh != null ? Number(stock.fiftyTwoWeekHigh) : null,
      sortOrder: stock.sortOrder,
    };
  }

  private mapPresetToResponse(preset: any): BudgetPresetResponseDto {
    const toDateStr = (d: Date | null) =>
      d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : null;
    return {
      id: preset.id,
      portfolioId: preset.portfolioId,
      name: preset.name,
      totalCapital: Number(preset.totalCapital),
      budgetYearStart: toDateStr(preset.budgetYearStart),
      budgetYearEnd: toDateStr(preset.budgetYearEnd),
      createdAt: preset.createdAt,
    };
  }

  private mapToResponse(portfolio: any): PortfolioResponseDto {
    const toDateStr = (d: Date | null) =>
      d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : null;
    return {
      id: portfolio.id,
      userId: portfolio.userId,
      name: portfolio.name,
      description: portfolio.description,
      totalCapital: Number(portfolio.totalCapital),
      budgetYearStart: toDateStr(portfolio.budgetYearStart),
      budgetYearEnd: toDateStr(portfolio.budgetYearEnd),
      currency: portfolio.currency,
      coreRatio: Number(portfolio.coreRatio ?? 0.60),
      dipRatio: Number(portfolio.dipRatio ?? 0.30),
      crashRatio: Number(portfolio.crashRatio ?? 0.10),
      dcaWeeksPerYear: portfolio.dcaWeeksPerYear ?? 48,
      isActive: portfolio.isActive,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
    };
  }
}
