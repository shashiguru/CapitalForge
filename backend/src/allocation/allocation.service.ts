import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private coreRatio: number;
  private dipRatio: number;
  private crashRatio: number;

  constructor(
    private prisma: PrismaService,
    private portfolioService: PortfolioService,
    private configService: ConfigService,
  ) {
    this.coreRatio = this.configService.get<number>('CORE_BUCKET_RATIO', 0.6);
    this.dipRatio = this.configService.get<number>('DIP_BUCKET_RATIO', 0.4);
    this.crashRatio = this.configService.get<number>('CRASH_BUCKET_RATIO', 0);
  }

  async create(
    portfolioId: string,
    userId: string,
    dto: CreateAllocationDto,
  ): Promise<AllocationResponseDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    // Check if allocation already exists for this symbol
    const existing = await this.prisma.allocation.findUnique({
      where: {
        portfolioId_symbol: {
          portfolioId,
          symbol: dto.symbol.toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Allocation for ${dto.symbol} already exists in this portfolio`,
      );
    }

    // Validate total percentage doesn't exceed 100%
    await this.validateTotalPercentage(portfolioId, dto.targetPercentage);

    // Get portfolio total capital for bucket calculation
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const totalCapital = Number(portfolio.totalCapital);
    const allocationUSD = (totalCapital * dto.targetPercentage) / 100;

    // Calculate bucket amounts (60% Core DCA, 40% Dip buy)
    const coreBucketUSD = allocationUSD * this.coreRatio;
    const dipBucketUSD = allocationUSD * this.dipRatio;
    const crashBucketUSD = allocationUSD * this.crashRatio;

    // Calculate DCA breakdown from Core bucket
    const monthlyDCA = coreBucketUSD / 12;
    const weeklyDCA = coreBucketUSD / 48;

    const allocation = await this.prisma.allocation.create({
      data: {
        portfolioId,
        symbol: dto.symbol.toUpperCase(),
        companyName: dto.companyName,
        targetPercentage: dto.targetPercentage,
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

  async findAll(
    portfolioId: string,
    userId: string,
  ): Promise<AllocationResponseDto[]> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const allocations = await this.prisma.allocation.findMany({
      where: { portfolioId, isActive: true },
      orderBy: { targetPercentage: 'desc' },
    });

    return allocations.map((a) => this.mapToResponse(a));
  }

  async findOne(
    id: string,
    userId: string,
  ): Promise<AllocationResponseDto> {
    const allocation = await this.prisma.allocation.findUnique({
      where: { id },
      include: { portfolio: true },
    });

    if (!allocation) {
      throw new NotFoundException('Allocation not found');
    }

    await this.portfolioService.validateOwnership(
      allocation.portfolioId,
      userId,
    );

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

    if (!allocation) {
      throw new NotFoundException('Allocation not found');
    }

    await this.portfolioService.validateOwnership(
      allocation.portfolioId,
      userId,
    );

    // Validate total percentage if updating target
    if (dto.targetPercentage !== undefined) {
      const currentPercentage = Number(allocation.targetPercentage);
      const diff = dto.targetPercentage - currentPercentage;
      await this.validateTotalPercentage(allocation.portfolioId, diff);
    }

    const totalCapital = Number(allocation.portfolio.totalCapital);
    const newTargetPercentage =
      dto.targetPercentage ?? Number(allocation.targetPercentage);
    const allocationUSD = (totalCapital * newTargetPercentage) / 100;

    // Recalculate bucket amounts
    const coreBucketUSD = allocationUSD * this.coreRatio;
    const dipBucketUSD = allocationUSD * this.dipRatio;
    const crashBucketUSD = allocationUSD * this.crashRatio;

    // Calculate DCA breakdown from Core bucket
    const monthlyDCA = coreBucketUSD / 12;
    const weeklyDCA = coreBucketUSD / 48;

    // Calculate remaining (bucket - used)
    const coreUsed = Number(allocation.coreUsedUSD);
    const dipUsed = Number(allocation.dipUsedUSD);
    const crashUsed = Number(allocation.crashUsedUSD);

    const updated = await this.prisma.allocation.update({
      where: { id },
      data: {
        ...(dto.companyName !== undefined && { companyName: dto.companyName }),
        ...(dto.targetPercentage !== undefined && {
          targetPercentage: dto.targetPercentage,
          allocationUSD,
          coreBucketUSD,
          dipBucketUSD,
          crashBucketUSD,
          monthlyDCA,
          weeklyDCA,
          coreRemainingUSD: coreBucketUSD - coreUsed,
          dipRemainingUSD: dipBucketUSD - dipUsed,
          crashRemainingUSD: crashBucketUSD - crashUsed,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return this.mapToResponse(updated);
  }

  async remove(id: string, userId: string): Promise<void> {
    const allocation = await this.prisma.allocation.findUnique({
      where: { id },
    });

    if (!allocation) {
      throw new NotFoundException('Allocation not found');
    }

    await this.portfolioService.validateOwnership(
      allocation.portfolioId,
      userId,
    );

    // Soft delete
    await this.prisma.allocation.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async bulkUpdate(
    portfolioId: string,
    userId: string,
    allocations: BulkUpdateAllocationDto[],
  ): Promise<AllocationResponseDto[]> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    // Validate total doesn't exceed 100%
    const totalPercentage = allocations.reduce(
      (sum, a) => sum + a.targetPercentage,
      0,
    );

    if (totalPercentage > 100) {
      throw new BadRequestException(
        `Total allocation (${totalPercentage}%) exceeds 100%`,
      );
    }

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const totalCapital = Number(portfolio.totalCapital);
    const results: AllocationResponseDto[] = [];

    for (const item of allocations) {
      const symbol = item.symbol.toUpperCase();
      const allocationUSD = (totalCapital * item.targetPercentage) / 100;
      const coreBucketUSD = allocationUSD * this.coreRatio;
      const dipBucketUSD = allocationUSD * this.dipRatio;
      const crashBucketUSD = allocationUSD * this.crashRatio;
      const monthlyDCA = coreBucketUSD / 12;
      const weeklyDCA = coreBucketUSD / 48;

      const allocation = await this.prisma.allocation.upsert({
        where: {
          portfolioId_symbol: { portfolioId, symbol },
        },
        create: {
          portfolioId,
          symbol,
          targetPercentage: item.targetPercentage,
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

  async getSummary(
    portfolioId: string,
    userId: string,
  ): Promise<AllocationSummaryDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const allocations = await this.prisma.allocation.findMany({
      where: { portfolioId, isActive: true },
    });

    const totalTargetPercentage = allocations.reduce(
      (sum, a) => sum + Number(a.targetPercentage),
      0,
    );
    const totalAllocationUSD = allocations.reduce(
      (sum, a) => sum + Number(a.allocationUSD),
      0,
    );
    const totalCoreBucketUSD = allocations.reduce(
      (sum, a) => sum + Number(a.coreBucketUSD),
      0,
    );
    const totalDipBucketUSD = allocations.reduce(
      (sum, a) => sum + Number(a.dipBucketUSD),
      0,
    );
    const totalCrashBucketUSD = allocations.reduce(
      (sum, a) => sum + Number(a.crashBucketUSD),
      0,
    );
    const totalMonthlyDCA = allocations.reduce(
      (sum, a) => sum + Number(a.monthlyDCA || 0),
      0,
    );
    const totalWeeklyDCA = allocations.reduce(
      (sum, a) => sum + Number(a.weeklyDCA || 0),
      0,
    );
    const totalCoreUsedUSD = allocations.reduce(
      (sum, a) => sum + Number(a.coreUsedUSD),
      0,
    );
    const totalDipUsedUSD = allocations.reduce(
      (sum, a) => sum + Number(a.dipUsedUSD),
      0,
    );
    const totalCrashUsedUSD = allocations.reduce(
      (sum, a) => sum + Number(a.crashUsedUSD),
      0,
    );
    const totalCoreRemainingUSD = allocations.reduce(
      (sum, a) => sum + Number(a.coreRemainingUSD || 0),
      0,
    );
    const totalDipRemainingUSD = allocations.reduce(
      (sum, a) => sum + Number(a.dipRemainingUSD || 0),
      0,
    );
    const totalCrashRemainingUSD = allocations.reduce(
      (sum, a) => sum + Number(a.crashRemainingUSD || 0),
      0,
    );
    const totalInvestedValue = allocations.reduce(
      (sum, a) => sum + Number(a.investedValue || 0),
      0,
    );

    const totalCapital = Number(portfolio.totalCapital);
    const unallocatedPercentage = 100 - totalTargetPercentage;
    const unallocatedUSD = totalCapital - totalAllocationUSD;

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
      unallocatedPercentage,
      unallocatedUSD,
    };
  }

  async recalculateBuckets(portfolioId: string): Promise<void> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const totalCapital = Number(portfolio.totalCapital);
    const allocations = await this.prisma.allocation.findMany({
      where: { portfolioId, isActive: true },
    });

    for (const allocation of allocations) {
      const allocationUSD =
        (totalCapital * Number(allocation.targetPercentage)) / 100;
      const coreBucketUSD = allocationUSD * this.coreRatio;
      const dipBucketUSD = allocationUSD * this.dipRatio;
      const crashBucketUSD = allocationUSD * this.crashRatio;
      const monthlyDCA = coreBucketUSD / 12;
      const weeklyDCA = coreBucketUSD / 48;

      // Calculate remaining based on usage
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
      allocationUSD: Number(allocation.allocationUSD),
      coreBucketUSD: coreBucket,
      dipBucketUSD: dipBucket,
      crashBucketUSD: crashBucket,
      monthlyDCA: Number(allocation.monthlyDCA || coreBucket / 12),
      weeklyDCA: Number(allocation.weeklyDCA || coreBucket / 48),
      coreUsedUSD: coreUsed,
      dipUsedUSD: dipUsed,
      crashUsedUSD: crashUsed,
      coreRemainingUSD: Number(allocation.coreRemainingUSD || (coreBucket - coreUsed)),
      dipRemainingUSD: Number(allocation.dipRemainingUSD || (dipBucket - dipUsed)),
      crashRemainingUSD: Number(allocation.crashRemainingUSD || (crashBucket - crashUsed)),
      sharesOwned: Number(allocation.sharesOwned),
      avgCostBasis: Number(allocation.avgCostBasis),
      investedValue: Number(allocation.investedValue || 0),
      isActive: allocation.isActive,
      createdAt: allocation.createdAt,
      updatedAt: allocation.updatedAt,
    };
  }
}
