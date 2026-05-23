import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import {
  CreateAllocationDto,
  UpdateAllocationDto,
  AllocationResponseDto,
  AllocationSummaryDto,
  BulkUpdateAllocationDto,
} from './dto/allocation.dto';

@Injectable()
export class AllocationService {
  constructor(
    private prisma: PrismaService,
    private portfolioService: PortfolioService,
  ) {}

  /** Compute all derived fields from the portfolio ratios + total capital */
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

  async create(
    portfolioId: string,
    userId: string,
    dto: CreateAllocationDto,
  ): Promise<AllocationResponseDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const existing = await this.prisma.allocation.findUnique({
      where: { portfolioId_symbol: { portfolioId, symbol: dto.symbol.toUpperCase() } },
    });

    if (existing) {
      throw new BadRequestException(
        `Allocation for ${dto.symbol} already exists in this portfolio`,
      );
    }

    await this.validateTotalPercentage(portfolioId, dto.targetPercentage);

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });

    if (!portfolio) throw new NotFoundException('Portfolio not found');

    const { allocationUSD, coreBucketUSD, dipBucketUSD, crashBucketUSD, monthlyDCA, weeklyDCA } =
      this.computeAllocationFields(
        Number(portfolio.totalCapital),
        dto.targetPercentage,
        Number(portfolio.coreRatio),
        Number(portfolio.dipRatio),
        Number(portfolio.crashRatio),
        portfolio.dcaWeeksPerYear,
      );

    const allocation = await this.prisma.allocation.create({
      data: {
        portfolioId,
        symbol: dto.symbol.toUpperCase(),
        companyName: dto.companyName,
        targetPercentage: dto.targetPercentage,
        isAggressive: dto.isAggressive ?? false,
        ...(dto.fiftyTwoWeekHigh !== undefined && {
          fiftyTwoWeekHigh: dto.fiftyTwoWeekHigh,
          fiftyTwoWeekHighUpdatedAt: new Date(),
        }),
        allocationUSD,
        coreBucketUSD,
        dipBucketUSD,
        crashBucketUSD,
        monthlyDCA,
        weeklyDCA,
        coreRemainingUSD: coreBucketUSD,
        dipRemainingUSD: dipBucketUSD,
        crashRemainingUSD: crashBucketUSD,
      },
    });

    await this.prisma.coreStock.upsert({
      where: { portfolioId_symbol: { portfolioId, symbol: allocation.symbol } },
      create: { portfolioId, symbol: allocation.symbol, displayName: dto.companyName },
      update: {},
    });

    return this.mapToResponse(allocation);
  }

  async findAll(portfolioId: string, userId: string): Promise<AllocationResponseDto[]> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const allocations = await this.prisma.allocation.findMany({
      where: { portfolioId, isActive: true },
      orderBy: { targetPercentage: 'desc' },
    });

    return allocations.map((a) => this.mapToResponse(a));
  }

  async findOne(id: string, userId: string): Promise<AllocationResponseDto> {
    const allocation = await this.prisma.allocation.findUnique({
      where: { id },
      include: { portfolio: true },
    });

    if (!allocation) throw new NotFoundException('Allocation not found');

    await this.portfolioService.validateOwnership(allocation.portfolioId, userId);

    return this.mapToResponse(allocation);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateAllocationDto,
  ): Promise<AllocationResponseDto> {
    const allocation = await this.prisma.allocation.findUnique({
      where: { id },
      include: { portfolio: true },
    });

    if (!allocation) throw new NotFoundException('Allocation not found');

    await this.portfolioService.validateOwnership(allocation.portfolioId, userId);

    if (dto.targetPercentage !== undefined) {
      const currentPercentage = Number(allocation.targetPercentage);
      const diff = dto.targetPercentage - currentPercentage;
      await this.validateTotalPercentage(allocation.portfolioId, diff);
    }

    const portfolio = allocation.portfolio;
    const newTargetPercentage = dto.targetPercentage ?? Number(allocation.targetPercentage);

    const { allocationUSD, coreBucketUSD, dipBucketUSD, crashBucketUSD, monthlyDCA, weeklyDCA } =
      this.computeAllocationFields(
        Number(portfolio.totalCapital),
        newTargetPercentage,
        Number(portfolio.coreRatio),
        Number(portfolio.dipRatio),
        Number(portfolio.crashRatio),
        portfolio.dcaWeeksPerYear,
      );

    const coreUsed = Number(allocation.coreUsedUSD);
    const dipUsed = Number(allocation.dipUsedUSD);
    const crashUsed = Number(allocation.crashUsedUSD);

    const updated = await this.prisma.allocation.update({
      where: { id },
      data: {
        ...(dto.companyName !== undefined && { companyName: dto.companyName }),
        ...(dto.isAggressive !== undefined && { isAggressive: dto.isAggressive }),
        ...(dto.fiftyTwoWeekHigh !== undefined && {
          fiftyTwoWeekHigh: dto.fiftyTwoWeekHigh,
          fiftyTwoWeekHighUpdatedAt: new Date(),
        }),
        ...(dto.targetPercentage !== undefined && {
          targetPercentage: dto.targetPercentage,
          allocationUSD,
          coreBucketUSD,
          dipBucketUSD,
          crashBucketUSD,
          monthlyDCA,
          weeklyDCA,
          coreRemainingUSD: Math.max(0, coreBucketUSD - coreUsed),
          dipRemainingUSD: Math.max(0, dipBucketUSD - dipUsed),
          crashRemainingUSD: Math.max(0, crashBucketUSD - crashUsed),
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return this.mapToResponse(updated);
  }

  async remove(id: string, userId: string): Promise<void> {
    const allocation = await this.prisma.allocation.findUnique({ where: { id } });

    if (!allocation) throw new NotFoundException('Allocation not found');

    await this.portfolioService.validateOwnership(allocation.portfolioId, userId);

    await this.prisma.allocation.update({ where: { id }, data: { isActive: false } });
  }

  async bulkUpdate(
    portfolioId: string,
    userId: string,
    allocations: BulkUpdateAllocationDto[],
  ): Promise<AllocationResponseDto[]> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const totalPercentage = allocations.reduce((sum, a) => sum + a.targetPercentage, 0);
    if (totalPercentage > 100) {
      throw new BadRequestException(
        `Total allocation (${totalPercentage}%) exceeds 100%`,
      );
    }

    const portfolio = await this.prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio) throw new NotFoundException('Portfolio not found');

    const results: AllocationResponseDto[] = [];

    for (const item of allocations) {
      const symbol = item.symbol.toUpperCase();
      const { allocationUSD, coreBucketUSD, dipBucketUSD, crashBucketUSD, monthlyDCA, weeklyDCA } =
        this.computeAllocationFields(
          Number(portfolio.totalCapital),
          item.targetPercentage,
          Number(portfolio.coreRatio),
          Number(portfolio.dipRatio),
          Number(portfolio.crashRatio),
          portfolio.dcaWeeksPerYear,
        );

      const allocation = await this.prisma.allocation.upsert({
        where: { portfolioId_symbol: { portfolioId, symbol } },
        create: {
          portfolioId,
          symbol,
          targetPercentage: item.targetPercentage,
          isAggressive: item.isAggressive ?? false,
          allocationUSD,
          coreBucketUSD,
          dipBucketUSD,
          crashBucketUSD,
          monthlyDCA,
          weeklyDCA,
          coreRemainingUSD: coreBucketUSD,
          dipRemainingUSD: dipBucketUSD,
          crashRemainingUSD: crashBucketUSD,
        },
        update: {
          targetPercentage: item.targetPercentage,
          ...(item.isAggressive !== undefined && { isAggressive: item.isAggressive }),
          allocationUSD,
          coreBucketUSD,
          dipBucketUSD,
          crashBucketUSD,
          monthlyDCA,
          weeklyDCA,
          isActive: true,
        },
      });

      await this.prisma.coreStock.upsert({
        where: { portfolioId_symbol: { portfolioId, symbol } },
        create: { portfolioId, symbol },
        update: {},
      });

      results.push(this.mapToResponse(allocation));
    }

    return results;
  }

  async getSummary(portfolioId: string, userId: string): Promise<AllocationSummaryDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const portfolio = await this.prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio) throw new NotFoundException('Portfolio not found');

    const allocations = await this.prisma.allocation.findMany({
      where: { portfolioId, isActive: true },
    });

    const sum = (fn: (a: typeof allocations[0]) => number) =>
      allocations.reduce((acc, a) => acc + fn(a), 0);

    const totalTargetPercentage = sum((a) => Number(a.targetPercentage));
    const totalAllocationUSD = sum((a) => Number(a.allocationUSD));
    const totalCoreBucketUSD = sum((a) => Number(a.coreBucketUSD));
    const totalDipBucketUSD = sum((a) => Number(a.dipBucketUSD));
    const totalCrashBucketUSD = sum((a) => Number(a.crashBucketUSD));
    const totalMonthlyDCA = sum((a) => Number(a.monthlyDCA || 0));
    const totalWeeklyDCA = sum((a) => Number(a.weeklyDCA || 0));
    const totalCoreUsedUSD = sum((a) => Number(a.coreUsedUSD));
    const totalDipUsedUSD = sum((a) => Number(a.dipUsedUSD));
    const totalCrashUsedUSD = sum((a) => Number(a.crashUsedUSD));
    const totalCoreRemainingUSD = sum((a) => Number(a.coreRemainingUSD || 0));
    const totalDipRemainingUSD = sum((a) => Number(a.dipRemainingUSD || 0));
    const totalCrashRemainingUSD = sum((a) => Number(a.crashRemainingUSD || 0));
    const totalInvestedValue = sum((a) => Number(a.investedValue || 0));

    const totalCapital = Number(portfolio.totalCapital);

    return {
      totalTargetPercentage,
      totalAllocationUSD,
      totalCoreBucketUSD,
      totalDipBucketUSD,
      totalCrashBucketUSD,
      totalMonthlyDCA,
      totalWeeklyDCA,
      totalCoreUsedUSD,
      totalDipUsedUSD,
      totalCrashUsedUSD,
      totalCoreRemainingUSD,
      totalDipRemainingUSD,
      totalCrashRemainingUSD,
      totalInvestedValue,
      allocationsCount: allocations.length,
      unallocatedPercentage: 100 - totalTargetPercentage,
      unallocatedUSD: totalCapital - totalAllocationUSD,
    };
  }

  /** Recalculate all allocation derived fields from current portfolio ratios + capital.
   *  Call this whenever totalCapital, coreRatio, dipRatio, crashRatio, or dcaWeeksPerYear changes.
   */
  async recalculateBuckets(portfolioId: string): Promise<void> {
    const portfolio = await this.prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio) throw new NotFoundException('Portfolio not found');

    const totalCapital = Number(portfolio.totalCapital);
    const coreRatio = Number(portfolio.coreRatio);
    const dipRatio = Number(portfolio.dipRatio);
    const crashRatio = Number(portfolio.crashRatio);
    const dcaWeeksPerYear = portfolio.dcaWeeksPerYear;

    const allocations = await this.prisma.allocation.findMany({
      where: { portfolioId, isActive: true },
    });

    for (const allocation of allocations) {
      const { allocationUSD, coreBucketUSD, dipBucketUSD, crashBucketUSD, monthlyDCA, weeklyDCA } =
        this.computeAllocationFields(
          totalCapital,
          Number(allocation.targetPercentage),
          coreRatio,
          dipRatio,
          crashRatio,
          dcaWeeksPerYear,
        );

      const coreUsed = Number(allocation.coreUsedUSD);
      const dipUsed = Number(allocation.dipUsedUSD);
      const crashUsed = Number(allocation.crashUsedUSD);

      await this.prisma.allocation.update({
        where: { id: allocation.id },
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

  private async validateTotalPercentage(
    portfolioId: string,
    additionalPercentage: number,
  ): Promise<void> {
    const existing = await this.prisma.allocation.aggregate({
      where: { portfolioId, isActive: true },
      _sum: { targetPercentage: true },
    });

    const currentTotal = Number(existing._sum.targetPercentage || 0);
    const newTotal = currentTotal + additionalPercentage;

    if (newTotal > 100) {
      throw new BadRequestException(
        `Total allocation (${newTotal.toFixed(2)}%) would exceed 100%. Current: ${currentTotal.toFixed(2)}%`,
      );
    }
  }

  private mapToResponse(allocation: any): AllocationResponseDto {
    const coreBucket = Number(allocation.coreBucketUSD);
    const dipBucket = Number(allocation.dipBucketUSD);
    const crashBucket = Number(allocation.crashBucketUSD);
    const coreUsed = Number(allocation.coreUsedUSD);
    const dipUsed = Number(allocation.dipUsedUSD);
    const crashUsed = Number(allocation.crashUsedUSD);

    return {
      id: allocation.id,
      portfolioId: allocation.portfolioId,
      symbol: allocation.symbol,
      companyName: allocation.companyName,
      targetPercentage: Number(allocation.targetPercentage),
      isAggressive: allocation.isAggressive ?? false,
      fiftyTwoWeekHigh: allocation.fiftyTwoWeekHigh != null ? Number(allocation.fiftyTwoWeekHigh) : null,
      fiftyTwoWeekHighUpdatedAt: allocation.fiftyTwoWeekHighUpdatedAt ?? null,
      allocationUSD: Number(allocation.allocationUSD),
      coreBucketUSD: coreBucket,
      dipBucketUSD: dipBucket,
      crashBucketUSD: crashBucket,
      monthlyDCA: Number(allocation.monthlyDCA || coreBucket / 12),
      weeklyDCA: Number(allocation.weeklyDCA || coreBucket / 48),
      coreUsedUSD: coreUsed,
      dipUsedUSD: dipUsed,
      crashUsedUSD: crashUsed,
      coreRemainingUSD: Number(allocation.coreRemainingUSD || Math.max(0, coreBucket - coreUsed)),
      dipRemainingUSD: Number(allocation.dipRemainingUSD || Math.max(0, dipBucket - dipUsed)),
      crashRemainingUSD: Number(allocation.crashRemainingUSD || Math.max(0, crashBucket - crashUsed)),
      sharesOwned: Number(allocation.sharesOwned),
      avgCostBasis: Number(allocation.avgCostBasis),
      investedValue: Number(allocation.investedValue || 0),
      lastWeeklyBuyPrice: allocation.lastWeeklyBuyPrice != null ? Number(allocation.lastWeeklyBuyPrice) : null,
      lastWeeklyBuyDate: allocation.lastWeeklyBuyDate ?? null,
      isActive: allocation.isActive,
      createdAt: allocation.createdAt,
      updatedAt: allocation.updatedAt,
    };
  }
}
