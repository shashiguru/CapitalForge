import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { MarketDataService } from '../market-data/market-data.service';
import {
  GenerateStrategyDto,
  StrategySnapshotDto,
  BuyPlanDto,
  DipLevel,
  BucketType,
  ExecuteBuyPlanDto,
  PortfolioStrategyTableDto,
  StockStrategyTableDto,
  DipLevelThresholdDto,
  StoredStrategyRulesDto,
  StockStrategyRulesDto,
} from './dto/strategy.dto';

// Type aliases for Prisma enum compatibility
type PrismaDipLevel = 'NORMAL_DCA' | 'LIGHT_DIP' | 'MODERATE_DIP' | 'DIP_BUCKET' | 'CRASH_BUCKET';
type PrismaBucketType = 'CORE' | 'DIP' | 'CRASH';

@Injectable()
export class StrategyService {
  constructor(
    private prisma: PrismaService,
    private portfolioService: PortfolioService,
    private marketDataService: MarketDataService,
  ) {}

  async generateStrategy(
    portfolioId: string,
    userId: string,
    dto: GenerateStrategyDto,
  ): Promise<StrategySnapshotDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    // Get portfolio and allocations
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        allocations: { where: { isActive: true } },
        weeklyBudgets: {
          orderBy: { weekStartDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    // Determine weekly budget
    const weeklyBudget =
      dto.weeklyBudget ||
      (portfolio.weeklyBudgets[0]
        ? Number(portfolio.weeklyBudgets[0].remainingAmount)
        : 0);

    if (weeklyBudget <= 0) {
      throw new BadRequestException('No weekly budget available');
    }

    // Sync market data for all symbols
    const symbols = portfolio.allocations.map((a) => a.symbol);
    await this.marketDataService.syncSymbols(symbols);

    // Create strategy snapshot
    const snapshot = await this.prisma.strategySnapshot.create({
      data: {
        portfolioId,
        asOfDate: new Date(),
        totalBudget: weeklyBudget,
        status: 'PENDING',
      },
    });

    // Generate buy plans for each allocation
    const buyPlans: BuyPlanDto[] = [];

    for (const allocation of portfolio.allocations) {
      const plan = await this.generateBuyPlan(
        snapshot.id,
        allocation,
        weeklyBudget / portfolio.allocations.length, // Simple equal split for now
      );

      if (plan) {
        buyPlans.push(plan);
      }
    }

    // Sort by dip percentage (highest first) and assign priority
    buyPlans.sort((a, b) => b.dipPercentage - a.dipPercentage);
    for (let i = 0; i < buyPlans.length; i++) {
      await this.prisma.buyPlan.update({
        where: { id: buyPlans[i].id },
        data: { priority: i + 1 },
      });
      buyPlans[i].priority = i + 1;
    }

    return {
      id: snapshot.id,
      portfolioId: snapshot.portfolioId,
      asOfDate: snapshot.asOfDate,
      totalBudget: Number(snapshot.totalBudget),
      status: snapshot.status,
      notes: snapshot.notes,
      buyPlans,
      createdAt: snapshot.createdAt,
    };
  }

  async getSnapshots(
    portfolioId: string,
    userId: string,
  ): Promise<StrategySnapshotDto[]> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const snapshots = await this.prisma.strategySnapshot.findMany({
      where: { portfolioId },
      include: { buyPlans: true },
      orderBy: { createdAt: 'desc' },
    });

    return snapshots.map((s) => this.mapSnapshotToDto(s));
  }

  async getSnapshot(
    snapshotId: string,
    userId: string,
  ): Promise<StrategySnapshotDto> {
    const snapshot = await this.prisma.strategySnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        buyPlans: { orderBy: { priority: 'asc' } },
        portfolio: true,
      },
    });

    if (!snapshot) {
      throw new NotFoundException('Strategy snapshot not found');
    }

    await this.portfolioService.validateOwnership(
      snapshot.portfolioId,
      userId,
    );

    return this.mapSnapshotToDto(snapshot);
  }

  async approveBuyPlan(
    buyPlanId: string,
    userId: string,
    approved: boolean,
  ): Promise<BuyPlanDto> {
    const buyPlan = await this.prisma.buyPlan.findUnique({
      where: { id: buyPlanId },
      include: { snapshot: { include: { portfolio: true } } },
    });

    if (!buyPlan) {
      throw new NotFoundException('Buy plan not found');
    }

    await this.portfolioService.validateOwnership(
      buyPlan.snapshot.portfolioId,
      userId,
    );

    const updated = await this.prisma.buyPlan.update({
      where: { id: buyPlanId },
      data: { isApproved: approved },
    });

    return this.mapBuyPlanToDto(updated);
  }

  async executeBuyPlan(
    buyPlanId: string,
    userId: string,
    dto: ExecuteBuyPlanDto,
  ): Promise<BuyPlanDto> {
    const buyPlan = await this.prisma.buyPlan.findUnique({
      where: { id: buyPlanId },
      include: {
        snapshot: {
          include: {
            portfolio: {
              include: { allocations: true, weeklyBudgets: true },
            },
          },
        },
      },
    });

    if (!buyPlan) {
      throw new NotFoundException('Buy plan not found');
    }

    await this.portfolioService.validateOwnership(
      buyPlan.snapshot.portfolioId,
      userId,
    );

    if (!buyPlan.isApproved) {
      throw new BadRequestException('Buy plan must be approved before execution');
    }

    if (buyPlan.isExecuted) {
      throw new BadRequestException('Buy plan already executed');
    }

    const executedPrice = dto.executedPrice || Number(buyPlan.suggestedPrice);
    const executedQuantity =
      dto.executedQuantity || Number(buyPlan.suggestedQuantity);
    const totalCost = executedPrice * executedQuantity;

    // Find the allocation for this symbol
    const allocation = buyPlan.snapshot.portfolio.allocations.find(
      (a) => a.symbol === buyPlan.symbol,
    );

    if (!allocation) {
      throw new NotFoundException('Allocation not found for symbol');
    }

    // Create transaction
    await this.prisma.transaction.create({
      data: {
        portfolioId: buyPlan.snapshot.portfolioId,
        symbol: buyPlan.symbol,
        type: 'BUY',
        price: executedPrice,
        quantity: executedQuantity,
        total: totalCost,
        date: new Date(),
        notes: dto.notes,
      },
    });

    // Update allocation - update bucket usage and shares owned
    const bucketField = this.getBucketUsedField(buyPlan.bucketUsed as any);
    const currentShares = Number(allocation.sharesOwned);
    const currentCostBasis = Number(allocation.avgCostBasis);
    const newShares = currentShares + executedQuantity;
    const newAvgCostBasis =
      newShares > 0
        ? (currentShares * currentCostBasis + totalCost) / newShares
        : executedPrice;

    await this.prisma.allocation.update({
      where: { id: allocation.id },
      data: {
        [bucketField]: { increment: totalCost },
        sharesOwned: newShares,
        avgCostBasis: newAvgCostBasis,
      },
    });

    // Update weekly budget if exists
    const currentBudget = buyPlan.snapshot.portfolio.weeklyBudgets[0];
    if (currentBudget) {
      await this.prisma.weeklyBudget.update({
        where: { id: currentBudget.id },
        data: {
          usedAmount: { increment: totalCost },
          remainingAmount: { decrement: totalCost },
        },
      });
    }

    // Mark buy plan as executed
    const updated = await this.prisma.buyPlan.update({
      where: { id: buyPlanId },
      data: {
        isExecuted: true,
        executedAt: new Date(),
      },
    });

    return this.mapBuyPlanToDto(updated);
  }

  private async generateBuyPlan(
    snapshotId: string,
    allocation: any,
    budgetShare: number,
  ): Promise<BuyPlanDto | null> {
    // Get latest market data
    const marketData = await this.marketDataService.getMarketDataSummary(
      allocation.symbol,
    );

    if (!marketData) {
      return null;
    }

    const currentPrice = marketData.latestPrice;
    const fiftyTwoWeekHigh = marketData.fiftyTwoWeekHigh;
    const dipPercentage = marketData.dipFromHigh;

    // Determine dip level
    const dipLevel = this.getDipLevel(dipPercentage);

    // Determine bucket to use and buy amount
    const { bucketUsed, buyUSD, reason } = this.determineBuyStrategy(
      dipLevel,
      allocation,
      budgetShare,
    );

    if (buyUSD <= 0) {
      return null;
    }

    // Calculate quantity (floor to whole shares)
    const suggestedQuantity = Math.floor(buyUSD / currentPrice);

    if (suggestedQuantity <= 0) {
      return null;
    }

    const capitalRequired = suggestedQuantity * currentPrice;

    // Create buy plan
    const buyPlan = await this.prisma.buyPlan.create({
      data: {
        snapshotId,
        symbol: allocation.symbol,
        currentPrice,
        fiftyTwoWeekHigh,
        dipPercentage,
        dipLevelTriggered: dipLevel as unknown as PrismaDipLevel,
        suggestedPrice: currentPrice,
        suggestedQuantity,
        capitalRequired,
        bucketUsed: bucketUsed as unknown as PrismaBucketType,
        reason,
        priority: 0,
      },
    });

    return this.mapBuyPlanToDto(buyPlan);
  }

  private getDipLevel(dipPercentage: number): DipLevel {
    if (dipPercentage >= 30) return DipLevel.CRASH_BUCKET;
    if (dipPercentage >= 20) return DipLevel.DIP_BUCKET;
    if (dipPercentage >= 15) return DipLevel.MODERATE_DIP;
    if (dipPercentage >= 10) return DipLevel.LIGHT_DIP;
    return DipLevel.NORMAL_DCA;
  }

  private determineBuyStrategy(
    dipLevel: DipLevel,
    allocation: any,
    budgetShare: number,
  ): { bucketUsed: BucketType; buyUSD: number; reason: string } {
    const coreRemaining =
      Number(allocation.coreBucketUSD) - Number(allocation.coreUsedUSD);
    const dipRemaining =
      Number(allocation.dipBucketUSD) - Number(allocation.dipUsedUSD);
    const crashRemaining =
      Number(allocation.crashBucketUSD) - Number(allocation.crashUsedUSD);

    switch (dipLevel) {
      case DipLevel.CRASH_BUCKET:
        // >30% dip - use crash bucket
        if (crashRemaining > 0) {
          return {
            bucketUsed: BucketType.CRASH,
            buyUSD: Math.min(crashRemaining, budgetShare),
            reason: `Crash zone (${dipLevel}): Deploying crash bucket capital`,
          };
        }
        // Fall through to dip bucket if crash exhausted
        if (dipRemaining > 0) {
          return {
            bucketUsed: BucketType.DIP,
            buyUSD: Math.min(dipRemaining, budgetShare),
            reason: `Crash zone but crash bucket exhausted: Using dip bucket`,
          };
        }
        break;

      case DipLevel.DIP_BUCKET:
        // 20-30% dip - use dip bucket
        if (dipRemaining > 0) {
          return {
            bucketUsed: BucketType.DIP,
            buyUSD: Math.min(dipRemaining, budgetShare),
            reason: `Significant dip (${dipLevel}): Deploying dip bucket capital`,
          };
        }
        break;

      case DipLevel.MODERATE_DIP:
      case DipLevel.LIGHT_DIP:
      case DipLevel.NORMAL_DCA:
        // <20% dip - use core bucket for regular DCA
        if (coreRemaining > 0) {
          return {
            bucketUsed: BucketType.CORE,
            buyUSD: Math.min(coreRemaining, budgetShare),
            reason: `Regular DCA (${dipLevel}): Using core bucket`,
          };
        }
        break;
    }

    // No budget available in appropriate bucket
    return {
      bucketUsed: BucketType.CORE,
      buyUSD: 0,
      reason: 'No remaining budget in appropriate bucket',
    };
  }

  private getBucketUsedField(bucket: BucketType): string {
    switch (bucket) {
      case BucketType.CORE:
        return 'coreUsedUSD';
      case BucketType.DIP:
        return 'dipUsedUSD';
      case BucketType.CRASH:
        return 'crashUsedUSD';
      default:
        return 'coreUsedUSD';
    }
  }

  private mapSnapshotToDto(snapshot: any): StrategySnapshotDto {
    return {
      id: snapshot.id,
      portfolioId: snapshot.portfolioId,
      asOfDate: snapshot.asOfDate,
      totalBudget: Number(snapshot.totalBudget),
      status: snapshot.status,
      notes: snapshot.notes,
      buyPlans: snapshot.buyPlans?.map((bp: any) => this.mapBuyPlanToDto(bp)) || [],
      createdAt: snapshot.createdAt,
    };
  }

  private mapBuyPlanToDto(buyPlan: any): BuyPlanDto {
    return {
      id: buyPlan.id,
      snapshotId: buyPlan.snapshotId,
      symbol: buyPlan.symbol,
      currentPrice: Number(buyPlan.currentPrice),
      fiftyTwoWeekHigh: Number(buyPlan.fiftyTwoWeekHigh),
      dipPercentage: Number(buyPlan.dipPercentage),
      dipLevelTriggered: buyPlan.dipLevelTriggered as DipLevel,
      suggestedPrice: Number(buyPlan.suggestedPrice),
      suggestedQuantity: Number(buyPlan.suggestedQuantity),
      capitalRequired: Number(buyPlan.capitalRequired),
      bucketUsed: buyPlan.bucketUsed as BucketType,
      reason: buyPlan.reason,
      priority: buyPlan.priority,
      isApproved: buyPlan.isApproved,
      isExecuted: buyPlan.isExecuted,
      executedAt: buyPlan.executedAt,
    };
  }

  /**
   * Generate pre-computed strategy table (matches Excel Strategy worksheet)
   * Shows thresholds at each dip level for all stocks
   */
  async getStrategyTable(
    portfolioId: string,
    userId: string,
  ): Promise<PortfolioStrategyTableDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        allocations: { where: { isActive: true } },
      },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    // Sync market data for all symbols
    const symbols = portfolio.allocations.map((a) => a.symbol);
    await this.marketDataService.syncSymbols(symbols);

    const stocks: StockStrategyTableDto[] = [];
    let totalWeeklyDCA = 0;

    for (const allocation of portfolio.allocations) {
      const marketData = await this.marketDataService.getMarketDataSummary(
        allocation.symbol,
      );

      const fiftyTwoWeekHigh = marketData?.fiftyTwoWeekHigh || 0;
      const currentPrice = marketData?.latestPrice || 0;
      const currentDipPercent = marketData?.dipFromHigh || 0;
      const weeklyDCA = Number(allocation.weeklyDCA || 0);
      const targetAllocationUSD = Number(allocation.allocationUSD);

      totalWeeklyDCA += weeklyDCA;

      // Calculate thresholds at each dip level
      const levels = {
        tenPercent: this.calculateDipThreshold(10, fiftyTwoWeekHigh, weeklyDCA, allocation),
        fifteenPercent: this.calculateDipThreshold(15, fiftyTwoWeekHigh, weeklyDCA, allocation),
        twentyPercent: this.calculateDipThreshold(20, fiftyTwoWeekHigh, weeklyDCA, allocation),
        thirtyPercent: this.calculateDipThreshold(30, fiftyTwoWeekHigh, weeklyDCA, allocation),
      };

      stocks.push({
        symbol: allocation.symbol,
        companyName: allocation.companyName,
        fiftyTwoWeekHigh,
        currentPrice,
        currentDipPercent,
        targetAllocationUSD,
        weeklyDCA,
        levels,
      });
    }

    // Sort by target allocation (largest first)
    stocks.sort((a, b) => b.targetAllocationUSD - a.targetAllocationUSD);

    return {
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      totalWeeklyDCA,
      asOfDate: new Date(),
      stocks,
    };
  }

  /**
   * Get stored strategy rules for a portfolio (user's predefined buy plan)
   */
  async getStrategyRules(
    portfolioId: string,
    userId: string,
  ): Promise<StoredStrategyRulesDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const rules = await this.prisma.strategyRule.findMany({
      where: { portfolioId },
      orderBy: [{ symbol: 'asc' }, { dipPercent: 'asc' }],
    });

    // Group by symbol
    const stocksMap = new Map<string, StockStrategyRulesDto>();
    for (const r of rules) {
      const symbol = r.symbol;
      if (!stocksMap.has(symbol)) {
        stocksMap.set(symbol, {
          symbol,
          fiftyTwoWeekHigh: Number(r.fiftyTwoWeekHigh),
          levels: [],
        });
      }
      const stock = stocksMap.get(symbol)!;
      stock.levels.push({
        dipPercent: r.dipPercent,
        dipLabel: r.dipPercent === 31 ? 'More than 30%' : `${r.dipPercent}%`,
        thresholdPrice: Number(r.thresholdPrice),
        buyQuantity: r.buyQuantity,
        weeklyDipQuantity: r.weeklyDipQuantity,
      });
    }

    // Sort levels within each stock
    for (const stock of stocksMap.values()) {
      stock.levels.sort((a, b) => a.dipPercent - b.dipPercent);
    }

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { allocations: { where: { isActive: true } } },
    });

    // Build symbol -> weeklyDCA from allocations (recalculated for current budget)
    const allocationWeeklyDCA = new Map<string, number>();
    if (portfolio?.allocations) {
      for (const a of portfolio.allocations) {
        const weeklyDCA = Number(a.weeklyDCA ?? 0);
        if (weeklyDCA > 0) {
          allocationWeeklyDCA.set(a.symbol, weeklyDCA);
        }
      }
    }

    // Scale strategy amounts by yearly budget ratio (current / reference)
    const totalCapital = portfolio ? Number(portfolio.totalCapital) : 0;
    const refBudget = portfolio?.strategyReferenceBudget != null
      ? Number(portfolio.strategyReferenceBudget)
      : totalCapital;
    const scale = refBudget > 0 ? totalCapital / refBudget : 1;

    const scaledStocks = Array.from(stocksMap.values()).map((stock) => {
      const weeklyDCA = allocationWeeklyDCA.get(stock.symbol);
      return {
        ...stock,
        levels: stock.levels.map((l) => {
          // For 0-20% dip (10% and 15%), use allocation's weeklyDCA so amounts match current budget
          const useAllocationDCA = (l.dipPercent === 10 || l.dipPercent === 15) && weeklyDCA != null;
          const buyQuantity = useAllocationDCA
            ? Math.round(weeklyDCA)
            : Math.round(l.buyQuantity * scale);
          const weeklyDipQuantity = l.weeklyDipQuantity != null ? Math.round(l.weeklyDipQuantity * scale) : null;
          return {
            ...l,
            buyQuantity,
            weeklyDipQuantity,
          };
        }),
      };
    });

    return {
      portfolioId,
      portfolioName: portfolio?.name || '',
      stocks: scaledStocks,
    };
  }

  /**
   * Calculate threshold and buy amounts for a specific dip level
   */
  private calculateDipThreshold(
    dipPercent: number,
    fiftyTwoWeekHigh: number,
    weeklyDCA: number,
    allocation: any,
  ): DipLevelThresholdDto {
    // Calculate threshold price at this dip level
    const thresholdPrice = fiftyTwoWeekHigh * (1 - dipPercent / 100);

    // Determine bucket and buy amount based on dip level
    let bucketUsed: BucketType;
    let buyUSD: number;
    let weeklyDipUSD: number;

    if (dipPercent >= 30) {
      // Crash-level dip: use crash bucket if > 0, else use dip bucket (60/40 split has no crash)
      const crashRemaining = Number(allocation.crashBucketUSD) - Number(allocation.crashUsedUSD);
      const dipRemaining = Number(allocation.dipBucketUSD) - Number(allocation.dipUsedUSD);
      if (crashRemaining > 0) {
        bucketUsed = BucketType.CRASH;
        buyUSD = Math.min(weeklyDCA * 5, crashRemaining);
      } else {
        bucketUsed = BucketType.DIP;
        buyUSD = Math.min(weeklyDCA * 5, dipRemaining);
      }
      weeklyDipUSD = weeklyDCA;
    } else if (dipPercent >= 20) {
      // Dip bucket: 3x weekly DCA
      bucketUsed = BucketType.DIP;
      const dipRemaining = Number(allocation.dipBucketUSD) - Number(allocation.dipUsedUSD);
      buyUSD = Math.min(weeklyDCA * 3, dipRemaining);
      weeklyDipUSD = weeklyDCA;
    } else if (dipPercent >= 15) {
      // Moderate dip: 2x weekly DCA from dip bucket
      bucketUsed = BucketType.DIP;
      const dipRemaining = Number(allocation.dipBucketUSD) - Number(allocation.dipUsedUSD);
      buyUSD = Math.min(weeklyDCA * 2, dipRemaining);
      weeklyDipUSD = weeklyDCA;
    } else {
      // Light dip or normal: regular weekly DCA from core
      bucketUsed = BucketType.CORE;
      buyUSD = weeklyDCA;
      weeklyDipUSD = 0; // No extra dip buy at 10%
    }

    return {
      dipPercent,
      thresholdPrice,
      buyUSD,
      weeklyDipUSD,
      bucketUsed,
    };
  }
}
