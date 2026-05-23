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
  StrategyRuleLevelDto,
  UpsertStrategyRuleDto,
} from './dto/strategy.dto';

type PrismaDipLevel = 'NORMAL_DCA' | 'LIGHT_DIP' | 'MODERATE_DIP' | 'DIP_BUCKET' | 'CRASH_BUCKET';
type PrismaBucketType = 'CORE' | 'DIP' | 'CRASH';

/** Dip level thresholds (percent below 52-week high) */
const DIP_LEVELS = [
  { dipPercent: 10, label: '10%', level: DipLevel.LIGHT_DIP },
  { dipPercent: 15, label: '15%', level: DipLevel.MODERATE_DIP },
  { dipPercent: 20, label: '20%', level: DipLevel.DIP_BUCKET },
  { dipPercent: 30, label: '30%', level: DipLevel.CRASH_BUCKET },
];

/** Default multipliers per Excel — normal stocks vs. aggressive ETFs (e.g. VONG) */
const NORMAL_MULTIPLIERS: Record<number, number> = { 10: 1, 15: 1, 20: 3, 30: 5 };
const AGGRESSIVE_MULTIPLIERS: Record<number, number> = { 10: 1, 15: 3, 20: 5, 30: 5 };

/** Weekly dip trigger: aggressive = active from 15%+; normal = active from 30%+ */
const WEEKLY_DIP_MULTIPLIER: Record<number, { normal: number; aggressive: number }> = {
  10: { normal: 0, aggressive: 0 },
  15: { normal: 0, aggressive: 1 },
  20: { normal: 0, aggressive: 0 },
  30: { normal: 1, aggressive: 1 },
};

@Injectable()
export class StrategyService {
  constructor(
    private prisma: PrismaService,
    private portfolioService: PortfolioService,
    private marketDataService: MarketDataService,
  ) {}

  // ─── Dip Classification ──────────────────────────────────────────────────

  getDipLevel(dipPercent: number): DipLevel {
    if (dipPercent >= 30) return DipLevel.CRASH_BUCKET;
    if (dipPercent >= 20) return DipLevel.DIP_BUCKET;
    if (dipPercent >= 15) return DipLevel.MODERATE_DIP;
    if (dipPercent >= 10) return DipLevel.LIGHT_DIP;
    return DipLevel.NORMAL_DCA;
  }

  getMultiplier(dipPercent: number, isAggressive: boolean, customMultipliers?: Map<number, number>): number {
    if (customMultipliers?.has(dipPercent)) return customMultipliers.get(dipPercent)!;
    const table = isAggressive ? AGGRESSIVE_MULTIPLIERS : NORMAL_MULTIPLIERS;
    // find the right bracket
    if (dipPercent >= 30) return table[30];
    if (dipPercent >= 20) return table[20];
    if (dipPercent >= 15) return table[15];
    return table[10];
  }

  selectBucket(dipPercent: number, isAggressive: boolean, allocation: any): BucketType {
    const dipTrigger = isAggressive ? 15 : 20;
    const crashRemaining = Math.max(0, Number(allocation.crashBucketUSD) - Number(allocation.crashUsedUSD));
    const dipRemaining = Math.max(0, Number(allocation.dipBucketUSD) - Number(allocation.dipUsedUSD));
    const coreRemaining = Math.max(0, Number(allocation.coreBucketUSD) - Number(allocation.coreUsedUSD));

    if (dipPercent >= 30) {
      if (crashRemaining > 0) return BucketType.CRASH;
      if (dipRemaining > 0) return BucketType.DIP;
      return BucketType.CORE;
    }
    if (dipPercent >= dipTrigger) {
      if (dipRemaining > 0) return BucketType.DIP;
      return BucketType.CORE;
    }
    return BucketType.CORE;
  }

  // ─── Live Strategy Table ─────────────────────────────────────────────────

  async getStrategyTable(portfolioId: string, userId: string): Promise<PortfolioStrategyTableDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { allocations: { where: { isActive: true } } },
    });

    if (!portfolio) throw new NotFoundException('Portfolio not found');

    const symbols = portfolio.allocations.map((a) => a.symbol);
    await this.marketDataService.syncSymbols(symbols);

    const stocks: StockStrategyTableDto[] = [];
    let totalWeeklyDCA = 0;
    const today = new Date();
    const weekStart = this.getWeekStart(today);

    // Load stored strategy rules to use custom multipliers if set
    const storedRules = await this.prisma.strategyRule.findMany({
      where: { portfolioId },
    });
    const rulesMap = new Map<string, Map<number, { buy: number; dip: number }>>();
    for (const r of storedRules) {
      if (!rulesMap.has(r.symbol)) rulesMap.set(r.symbol, new Map());
      rulesMap.get(r.symbol)!.set(r.dipPercent, {
        buy: r.buyMultiplier,
        dip: r.weeklyDipMultiplier,
      });
    }

    for (const allocation of portfolio.allocations) {
      const market = await this.marketDataService.getMarketDataSummary(allocation.symbol);
      const currentPrice = market?.latestPrice || 0;
      const liveFiftyTwoWeekHigh = market?.fiftyTwoWeekHigh || 0;
      const weeklyDCA = Number(allocation.weeklyDCA || 0);
      const isAggressive = allocation.isAggressive ?? false;

      // Use stored 52w high if available; otherwise use live value
      const refHigh = allocation.fiftyTwoWeekHigh
        ? Number(allocation.fiftyTwoWeekHigh)
        : liveFiftyTwoWeekHigh;

      const currentDipPercent =
        refHigh > 0 && currentPrice > 0
          ? Math.max(0, ((refHigh - currentPrice) / refHigh) * 100)
          : market?.dipFromHigh || 0;

      const currentDipLevel = this.getDipLevel(currentDipPercent);
      totalWeeklyDCA += weeklyDCA;

      const symbolRules = rulesMap.get(allocation.symbol);

      // Build threshold levels
      const levels: DipLevelThresholdDto[] = DIP_LEVELS.map(({ dipPercent, label }) => {
        const customMultipliers = symbolRules
          ? new Map(Array.from(symbolRules.entries()).map(([k, v]) => [k, v.buy]))
          : undefined;
        const multiplier = this.getMultiplier(dipPercent, isAggressive, customMultipliers);

        const weeklyDipMult = symbolRules?.get(dipPercent)?.dip
          ?? WEEKLY_DIP_MULTIPLIER[dipPercent]?.[isAggressive ? 'aggressive' : 'normal'] ?? 0;

        const thresholdPrice = refHigh > 0 ? refHigh * (1 - dipPercent / 100) : 0;
        const buyUSD = weeklyDCA * multiplier;
        const buyShares = currentPrice > 0 ? Math.floor(buyUSD / currentPrice) : 0;
        const weeklyDipUSD = weeklyDCA * weeklyDipMult;
        const bucket = this.selectBucket(dipPercent, isAggressive, allocation);
        const isActive = thresholdPrice > 0 && currentPrice <= thresholdPrice;

        return {
          dipPercent,
          dipLabel: label,
          thresholdPrice,
          buyUSD,
          buyShares,
          weeklyDipUSD,
          multiplier,
          bucketUsed: bucket,
          isActive,
        };
      });

      // Normal DCA level (< 10% dip) — not in the threshold table but shown
      const normalLevel: DipLevelThresholdDto = {
        dipPercent: 0,
        dipLabel: 'Normal DCA',
        thresholdPrice: refHigh > 0 ? refHigh * 0.9 : 0, // upper bound of normal range
        buyUSD: weeklyDCA,
        buyShares: currentPrice > 0 ? Math.floor(weeklyDCA / currentPrice) : 0,
        weeklyDipUSD: 0,
        multiplier: 1,
        bucketUsed: BucketType.CORE,
        isActive: currentDipPercent < 10,
      };

      // Check intra-week dip trigger
      const lastBuyPrice = allocation.lastWeeklyBuyPrice
        ? Number(allocation.lastWeeklyBuyPrice)
        : null;
      const lastBuyDate = allocation.lastWeeklyBuyDate
        ? new Date(allocation.lastWeeklyBuyDate)
        : null;
      const isSameWeek = lastBuyDate ? lastBuyDate >= weekStart : false;
      const dipTriggerLevel = isAggressive ? 15 : 30;
      const dropFromBuy =
        lastBuyPrice && currentPrice
          ? (lastBuyPrice - currentPrice) / lastBuyPrice
          : 0;
      const isWeeklyDipTriggered =
        isSameWeek &&
        lastBuyPrice !== null &&
        dropFromBuy >= 0.03 &&
        currentDipPercent >= dipTriggerLevel;

      stocks.push({
        symbol: allocation.symbol,
        companyName: allocation.companyName,
        isAggressive,
        storedFiftyTwoWeekHigh: allocation.fiftyTwoWeekHigh
          ? Number(allocation.fiftyTwoWeekHigh)
          : null,
        fiftyTwoWeekHighUpdatedAt: allocation.fiftyTwoWeekHighUpdatedAt ?? null,
        liveFiftyTwoWeekHigh,
        currentPrice,
        currentDipPercent,
        currentDipLevel,
        targetAllocationUSD: Number(allocation.allocationUSD),
        weeklyDCA,
        coreRemainingUSD: Math.max(0, Number(allocation.coreBucketUSD) - Number(allocation.coreUsedUSD)),
        dipRemainingUSD: Math.max(0, Number(allocation.dipBucketUSD) - Number(allocation.dipUsedUSD)),
        crashRemainingUSD: Math.max(0, Number(allocation.crashBucketUSD) - Number(allocation.crashUsedUSD)),
        isWeeklyDipTriggered,
        weeklyDipOpportunityUSD: isWeeklyDipTriggered ? weeklyDCA : 0,
        lastWeeklyBuyPrice: lastBuyPrice,
        levels: [normalLevel, ...levels],
      });
    }

    stocks.sort((a, b) => b.targetAllocationUSD - a.targetAllocationUSD);

    return {
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      totalWeeklyDCA,
      asOfDate: new Date(),
      stocks,
    };
  }

  // ─── Stored Strategy Rules ───────────────────────────────────────────────

  async getStrategyRules(portfolioId: string, userId: string): Promise<StoredStrategyRulesDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { allocations: { where: { isActive: true } } },
    });

    if (!portfolio) throw new NotFoundException('Portfolio not found');

    const rules = await this.prisma.strategyRule.findMany({
      where: { portfolioId },
      orderBy: [{ symbol: 'asc' }, { dipPercent: 'asc' }],
    });

    // Group rules by symbol
    const rulesMap = new Map<string, Map<number, { buy: number; dip: number }>>();
    for (const r of rules) {
      if (!rulesMap.has(r.symbol)) rulesMap.set(r.symbol, new Map());
      rulesMap.get(r.symbol)!.set(r.dipPercent, {
        buy: r.buyMultiplier,
        dip: r.weeklyDipMultiplier,
      });
    }

    const allocationMap = new Map(
      portfolio.allocations.map((a) => [a.symbol, a]),
    );

    const stocks: StockStrategyRulesDto[] = portfolio.allocations.map((a) => {
      const weeklyDCA = Number(a.weeklyDCA || 0);
      const isAggressive = a.isAggressive ?? false;
      const symbolRules = rulesMap.get(a.symbol);

      const levels: StrategyRuleLevelDto[] = DIP_LEVELS.map(({ dipPercent, label }) => {
        const customMultipliers = symbolRules
          ? new Map(Array.from(symbolRules.entries()).map(([k, v]) => [k, v.buy]))
          : undefined;
        const buyMultiplier = this.getMultiplier(dipPercent, isAggressive, customMultipliers);
        const weeklyDipMultiplier =
          symbolRules?.get(dipPercent)?.dip ??
          WEEKLY_DIP_MULTIPLIER[dipPercent]?.[isAggressive ? 'aggressive' : 'normal'] ?? 0;

        const refHigh = a.fiftyTwoWeekHigh ? Number(a.fiftyTwoWeekHigh) : null;
        const thresholdPrice = refHigh ? refHigh * (1 - dipPercent / 100) : 0;
        const buyUSD = weeklyDCA * buyMultiplier;
        const weeklyDipUSD = weeklyDCA * weeklyDipMultiplier;

        return {
          dipPercent,
          dipLabel: label,
          buyMultiplier,
          weeklyDipMultiplier,
          buyUSD,
          buyShares: 0, // no current price available here
          weeklyDipUSD,
          thresholdPrice,
        };
      });

      return {
        symbol: a.symbol,
        isAggressive,
        fiftyTwoWeekHigh: a.fiftyTwoWeekHigh ? Number(a.fiftyTwoWeekHigh) : null,
        weeklyDCA,
        levels,
      };
    });

    return {
      portfolioId,
      portfolioName: portfolio.name,
      stocks,
    };
  }

  async upsertStrategyRule(
    portfolioId: string,
    userId: string,
    dto: UpsertStrategyRuleDto,
  ): Promise<void> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    await this.prisma.strategyRule.upsert({
      where: {
        portfolioId_symbol_dipPercent: {
          portfolioId,
          symbol: dto.symbol.toUpperCase(),
          dipPercent: dto.dipPercent,
        },
      },
      create: {
        portfolioId,
        symbol: dto.symbol.toUpperCase(),
        dipPercent: dto.dipPercent,
        buyMultiplier: dto.buyMultiplier,
        weeklyDipMultiplier: dto.weeklyDipMultiplier ?? 0,
      },
      update: {
        buyMultiplier: dto.buyMultiplier,
        weeklyDipMultiplier: dto.weeklyDipMultiplier ?? 0,
      },
    });
  }

  // ─── Strategy Snapshots (buy plan generation) ────────────────────────────

  async generateStrategy(
    portfolioId: string,
    userId: string,
    dto: GenerateStrategyDto,
  ): Promise<StrategySnapshotDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        allocations: { where: { isActive: true } },
        weeklyBudgets: { orderBy: { weekStartDate: 'desc' }, take: 1 },
      },
    });

    if (!portfolio) throw new NotFoundException('Portfolio not found');

    const weeklyBudget =
      dto.weeklyBudget ||
      (portfolio.weeklyBudgets[0]
        ? Number(portfolio.weeklyBudgets[0].remainingAmount)
        : 0);

    if (weeklyBudget <= 0) throw new BadRequestException('No weekly budget available');

    const symbols = portfolio.allocations.map((a) => a.symbol);
    await this.marketDataService.syncSymbols(symbols);

    const snapshot = await this.prisma.strategySnapshot.create({
      data: {
        portfolioId,
        asOfDate: new Date(),
        totalBudget: weeklyBudget,
        status: 'PENDING',
      },
    });

    const buyPlans: BuyPlanDto[] = [];

    for (const allocation of portfolio.allocations) {
      const plan = await this.generateBuyPlan(snapshot.id, allocation);
      if (plan) buyPlans.push(plan);
    }

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

  async getSnapshots(portfolioId: string, userId: string): Promise<StrategySnapshotDto[]> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const snapshots = await this.prisma.strategySnapshot.findMany({
      where: { portfolioId },
      include: { buyPlans: true },
      orderBy: { createdAt: 'desc' },
    });

    return snapshots.map((s) => this.mapSnapshotToDto(s));
  }

  async getSnapshot(snapshotId: string, userId: string): Promise<StrategySnapshotDto> {
    const snapshot = await this.prisma.strategySnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        buyPlans: { orderBy: { priority: 'asc' } },
        portfolio: true,
      },
    });

    if (!snapshot) throw new NotFoundException('Strategy snapshot not found');

    await this.portfolioService.validateOwnership(snapshot.portfolioId, userId);

    return this.mapSnapshotToDto(snapshot);
  }

  async approveBuyPlan(buyPlanId: string, userId: string, approved: boolean): Promise<BuyPlanDto> {
    const buyPlan = await this.prisma.buyPlan.findUnique({
      where: { id: buyPlanId },
      include: { snapshot: { include: { portfolio: true } } },
    });

    if (!buyPlan) throw new NotFoundException('Buy plan not found');

    await this.portfolioService.validateOwnership(buyPlan.snapshot.portfolioId, userId);

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
            portfolio: { include: { allocations: true, weeklyBudgets: true } },
          },
        },
      },
    });

    if (!buyPlan) throw new NotFoundException('Buy plan not found');
    await this.portfolioService.validateOwnership(buyPlan.snapshot.portfolioId, userId);

    if (!buyPlan.isApproved) {
      throw new BadRequestException('Buy plan must be approved before execution');
    }
    if (buyPlan.isExecuted) {
      throw new BadRequestException('Buy plan already executed');
    }

    const executedPrice = dto.executedPrice || Number(buyPlan.suggestedPrice);
    const executedQuantity = dto.executedQuantity || Number(buyPlan.suggestedQuantity);
    const totalCost = executedPrice * executedQuantity;

    const allocation = buyPlan.snapshot.portfolio.allocations.find(
      (a) => a.symbol === buyPlan.symbol,
    );

    if (!allocation) throw new NotFoundException('Allocation not found for symbol');

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

    const bucketUsedField = this.getBucketUsedField(buyPlan.bucketUsed as BucketType);
    const bucketRemainingField = this.getBucketRemainingField(buyPlan.bucketUsed as BucketType);
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
        [bucketUsedField]: { increment: totalCost },
        [bucketRemainingField]: { decrement: totalCost },
        sharesOwned: newShares,
        avgCostBasis: newAvgCostBasis,
        lastWeeklyBuyPrice: executedPrice,
        lastWeeklyBuyDate: new Date(),
      },
    });

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

    const updated = await this.prisma.buyPlan.update({
      where: { id: buyPlanId },
      data: { isExecuted: true, executedAt: new Date() },
    });

    return this.mapBuyPlanToDto(updated);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async generateBuyPlan(
    snapshotId: string,
    allocation: any,
  ): Promise<BuyPlanDto | null> {
    const market = await this.marketDataService.getMarketDataSummary(allocation.symbol);
    if (!market) return null;

    const currentPrice = market.latestPrice;
    const liveFiftyTwoWeekHigh = market.fiftyTwoWeekHigh;
    const refHigh = allocation.fiftyTwoWeekHigh
      ? Number(allocation.fiftyTwoWeekHigh)
      : liveFiftyTwoWeekHigh;

    const dipPercentage =
      refHigh > 0 && currentPrice > 0
        ? Math.max(0, ((refHigh - currentPrice) / refHigh) * 100)
        : market.dipFromHigh;

    const dipLevel = this.getDipLevel(dipPercentage);
    const isAggressive = allocation.isAggressive ?? false;
    const weeklyDCA = Number(allocation.weeklyDCA || 0);
    const multiplier = this.getMultiplier(dipPercentage, isAggressive);
    const buyUSD = weeklyDCA * multiplier;

    if (buyUSD <= 0) return null;

    const suggestedQuantity = Math.floor(buyUSD / currentPrice);
    if (suggestedQuantity <= 0) return null;

    const capitalRequired = suggestedQuantity * currentPrice;
    const bucketUsed = this.selectBucket(dipPercentage, isAggressive, allocation);

    const buyPlan = await this.prisma.buyPlan.create({
      data: {
        snapshotId,
        symbol: allocation.symbol,
        currentPrice,
        fiftyTwoWeekHigh: refHigh,
        dipPercentage,
        dipLevelTriggered: dipLevel as unknown as PrismaDipLevel,
        suggestedPrice: currentPrice,
        suggestedQuantity,
        capitalRequired,
        bucketUsed: bucketUsed as unknown as PrismaBucketType,
        reason: `${dipLevel} (${dipPercentage.toFixed(1)}% dip): ${multiplier}× weeklyDCA`,
        priority: 0,
      },
    });

    return this.mapBuyPlanToDto(buyPlan);
  }

  private getBucketUsedField(bucket: BucketType): string {
    const map: Record<BucketType, string> = {
      [BucketType.CORE]: 'coreUsedUSD',
      [BucketType.DIP]: 'dipUsedUSD',
      [BucketType.CRASH]: 'crashUsedUSD',
    };
    return map[bucket] ?? 'coreUsedUSD';
  }

  private getBucketRemainingField(bucket: BucketType): string {
    const map: Record<BucketType, string> = {
      [BucketType.CORE]: 'coreRemainingUSD',
      [BucketType.DIP]: 'dipRemainingUSD',
      [BucketType.CRASH]: 'crashRemainingUSD',
    };
    return map[bucket] ?? 'coreRemainingUSD';
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
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
}
