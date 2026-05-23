import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { AllocationService } from '../allocation/allocation.service';
import { BudgetService } from '../budget/budget.service';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  TransactionResponseDto,
  TransactionFilterDto,
  TransactionType,
  BulkImportDto,
  TransactionSummaryDto,
} from './dto/transaction.dto';

type PrismaTransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE';

@Injectable()
export class TransactionService {
  constructor(
    private prisma: PrismaService,
    private portfolioService: PortfolioService,
    private allocationService: AllocationService,
    private budgetService: BudgetService,
  ) {}

  async create(
    portfolioId: string,
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const total = dto.price * dto.quantity;
    const symbol = dto.symbol.toUpperCase();

    const transaction = await this.prisma.transaction.create({
      data: {
        portfolioId,
        symbol,
        type: dto.type as PrismaTransactionType,
        price: dto.price,
        quantity: dto.quantity,
        total,
        fees: dto.fees || 0,
        notes: dto.notes,
        date: new Date(dto.date),
      },
    });

    if (dto.type === TransactionType.BUY || dto.type === TransactionType.SELL) {
      await this.applyAllocationEffect(portfolioId, symbol, dto.type, dto.price, dto.quantity, total);
    }

    if (dto.type === TransactionType.BUY) {
      await this.budgetService.deductFromBudget(portfolioId, total);
    }

    return this.mapToResponse(transaction);
  }

  async findAll(
    portfolioId: string,
    userId: string,
    filter?: TransactionFilterDto,
  ): Promise<TransactionResponseDto[]> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const where: any = { portfolioId };

    if (filter?.symbol) where.symbol = filter.symbol.toUpperCase();
    if (filter?.type) where.type = filter.type;

    if (filter?.startDate || filter?.endDate) {
      where.date = {};
      if (filter.startDate) where.date.gte = new Date(filter.startDate);
      if (filter.endDate) where.date.lte = new Date(filter.endDate);
    }

    const page = filter?.page || 1;
    const pageSize = filter?.pageSize || 50;
    const skip = (page - 1) * pageSize;

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: pageSize,
    });

    return transactions.map((t) => this.mapToResponse(t));
  }

  async findOne(id: string, userId: string): Promise<TransactionResponseDto> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: { portfolio: true },
    });

    if (!transaction) throw new NotFoundException('Transaction not found');

    await this.portfolioService.validateOwnership(transaction.portfolioId, userId);

    return this.mapToResponse(transaction);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const original = await this.prisma.transaction.findUnique({ where: { id } });
    if (!original) throw new NotFoundException('Transaction not found');

    await this.portfolioService.validateOwnership(original.portfolioId, userId);

    const origType = original.type as TransactionType;
    const origPrice = Number(original.price);
    const origQty = Number(original.quantity);
    const origTotal = Number(original.total);
    const origSymbol = original.symbol;

    // Reverse the original allocation effect
    if (origType === TransactionType.BUY || origType === TransactionType.SELL) {
      await this.reverseAllocationEffect(
        original.portfolioId,
        origSymbol,
        origType,
        origPrice,
        origQty,
        origTotal,
      );
    }

    if (origType === TransactionType.BUY) {
      await this.budgetService.restoreToBudget(original.portfolioId, origTotal);
    }

    const newPrice = dto.price ?? origPrice;
    const newQty = dto.quantity ?? origQty;
    const newTotal = newPrice * newQty;
    const newSymbol = dto.symbol ? dto.symbol.toUpperCase() : origSymbol;
    const newType = (dto.type ?? origType) as TransactionType;

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.symbol !== undefined && { symbol: newSymbol }),
        ...(dto.type !== undefined && { type: dto.type as PrismaTransactionType }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.price !== undefined || dto.quantity !== undefined ? { total: newTotal } : {}),
        ...(dto.fees !== undefined && { fees: dto.fees }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
      },
    });

    // Apply the new allocation effect
    if (newType === TransactionType.BUY || newType === TransactionType.SELL) {
      await this.applyAllocationEffect(
        original.portfolioId,
        newSymbol,
        newType,
        newPrice,
        newQty,
        newTotal,
      );
    }

    if (newType === TransactionType.BUY) {
      await this.budgetService.deductFromBudget(original.portfolioId, newTotal);
    }

    return this.mapToResponse(updated);
  }

  async remove(id: string, userId: string): Promise<void> {
    const transaction = await this.prisma.transaction.findUnique({ where: { id } });
    if (!transaction) throw new NotFoundException('Transaction not found');

    await this.portfolioService.validateOwnership(transaction.portfolioId, userId);

    const txType = transaction.type as TransactionType;
    const txPrice = Number(transaction.price);
    const txQty = Number(transaction.quantity);
    const txTotal = Number(transaction.total);

    // Reverse allocation effects before deleting
    if (txType === TransactionType.BUY || txType === TransactionType.SELL) {
      await this.reverseAllocationEffect(
        transaction.portfolioId,
        transaction.symbol,
        txType,
        txPrice,
        txQty,
        txTotal,
      );
    }

    if (txType === TransactionType.BUY) {
      await this.budgetService.restoreToBudget(transaction.portfolioId, txTotal);
    }

    await this.prisma.transaction.delete({ where: { id } });
  }

  async bulkImport(
    portfolioId: string,
    userId: string,
    dto: BulkImportDto,
  ): Promise<TransactionResponseDto[]> {
    await this.portfolioService.validateOwnership(portfolioId, userId);
    const results: TransactionResponseDto[] = [];
    for (const item of dto.transactions) {
      const tx = await this.create(portfolioId, userId, { ...item, notes: item.notes ?? 'Imported' });
      results.push(tx);
    }
    return results;
  }

  async getSummary(portfolioId: string, userId: string): Promise<TransactionSummaryDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const transactions = await this.prisma.transaction.findMany({ where: { portfolioId } });

    let totalBuys = 0;
    let totalSells = 0;
    let totalDividends = 0;
    let totalFees = 0;

    for (const t of transactions) {
      const total = Number(t.total);
      switch (t.type) {
        case 'BUY': totalBuys += total; break;
        case 'SELL': totalSells += total; break;
        case 'DIVIDEND': totalDividends += total; break;
        case 'FEE': totalFees += total; break;
      }
      totalFees += Number(t.fees);
    }

    return {
      totalBuys,
      totalSells,
      totalDividends,
      totalFees,
      netInvested: totalBuys - totalSells,
      transactionCount: transactions.length,
    };
  }

  // ─── Allocation effect helpers ───────────────────────────────────────────

  /** Apply a transaction's effect to the allocation (shares, cost basis).
   *  For BUY, also increments bucket usage and decrements remaining.
   */
  private async applyAllocationEffect(
    portfolioId: string,
    symbol: string,
    type: TransactionType,
    price: number,
    quantity: number,
    total: number,
  ): Promise<void> {
    const allocation = await this.prisma.allocation.findUnique({
      where: { portfolioId_symbol: { portfolioId, symbol } },
    });

    if (!allocation) return;

    const currentShares = Number(allocation.sharesOwned);
    const currentCostBasis = Number(allocation.avgCostBasis);

    if (type === TransactionType.BUY) {
      const newShares = currentShares + quantity;
      const newCostBasis =
        newShares > 0
          ? (currentShares * currentCostBasis + price * quantity) / newShares
          : price;

      // Determine appropriate bucket based on current dip level
      // We use a simple heuristic: deduct from core first, then dip, then crash
      const coreRemaining = Math.max(0, Number(allocation.coreRemainingUSD));
      const dipRemaining = Math.max(0, Number(allocation.dipRemainingUSD));
      const crashRemaining = Math.max(0, Number(allocation.crashRemainingUSD));

      let coreDeduct = 0, dipDeduct = 0, crashDeduct = 0;
      let remaining = total;

      if (coreRemaining > 0 && remaining > 0) {
        coreDeduct = Math.min(remaining, coreRemaining);
        remaining -= coreDeduct;
      }
      if (dipRemaining > 0 && remaining > 0) {
        dipDeduct = Math.min(remaining, dipRemaining);
        remaining -= dipDeduct;
      }
      if (crashRemaining > 0 && remaining > 0) {
        crashDeduct = Math.min(remaining, crashRemaining);
        remaining -= crashDeduct;
      }

      await this.prisma.allocation.update({
        where: { id: allocation.id },
        data: {
          sharesOwned: newShares,
          avgCostBasis: newCostBasis,
          coreUsedUSD: { increment: coreDeduct },
          dipUsedUSD: { increment: dipDeduct },
          crashUsedUSD: { increment: crashDeduct },
          coreRemainingUSD: { decrement: coreDeduct },
          dipRemainingUSD: { decrement: dipDeduct },
          crashRemainingUSD: { decrement: crashDeduct },
          lastWeeklyBuyPrice: price,
          lastWeeklyBuyDate: new Date(),
        },
      });
    } else if (type === TransactionType.SELL) {
      const newShares = Math.max(0, currentShares - quantity);
      await this.prisma.allocation.update({
        where: { id: allocation.id },
        data: { sharesOwned: newShares },
      });
    }
  }

  /** Reverse a previously applied transaction effect.
   *  Rebuilds shares and cost basis from remaining transactions.
   */
  private async reverseAllocationEffect(
    portfolioId: string,
    symbol: string,
    type: TransactionType,
    price: number,
    quantity: number,
    total: number,
  ): Promise<void> {
    const allocation = await this.prisma.allocation.findUnique({
      where: { portfolioId_symbol: { portfolioId, symbol } },
    });

    if (!allocation) return;

    if (type === TransactionType.BUY) {
      const currentShares = Number(allocation.sharesOwned);
      const currentCostBasis = Number(allocation.avgCostBasis);

      // Reverse the weighted average cost basis
      const prevShares = currentShares - quantity;
      const newCostBasis =
        prevShares > 0 && currentShares > 0
          ? (currentShares * currentCostBasis - price * quantity) / prevShares
          : 0;

      // Restore bucket usage (proportionally from used amounts)
      const coreUsed = Number(allocation.coreUsedUSD);
      const dipUsed = Number(allocation.dipUsedUSD);
      const crashUsed = Number(allocation.crashUsedUSD);
      const totalUsed = coreUsed + dipUsed + crashUsed;

      let coreRestore = 0, dipRestore = 0, crashRestore = 0;
      if (totalUsed > 0) {
        coreRestore = (coreUsed / totalUsed) * total;
        dipRestore = (dipUsed / totalUsed) * total;
        crashRestore = total - coreRestore - dipRestore;
      } else {
        coreRestore = total;
      }

      await this.prisma.allocation.update({
        where: { id: allocation.id },
        data: {
          sharesOwned: Math.max(0, prevShares),
          avgCostBasis: Math.max(0, newCostBasis),
          coreUsedUSD: { decrement: coreRestore },
          dipUsedUSD: { decrement: dipRestore },
          crashUsedUSD: { decrement: crashRestore },
          coreRemainingUSD: { increment: coreRestore },
          dipRemainingUSD: { increment: dipRestore },
          crashRemainingUSD: { increment: crashRestore },
        },
      });
    } else if (type === TransactionType.SELL) {
      // Restore shares that were removed
      const currentShares = Number(allocation.sharesOwned);
      await this.prisma.allocation.update({
        where: { id: allocation.id },
        data: { sharesOwned: currentShares + quantity },
      });
    }
  }

  private mapToResponse(transaction: any): TransactionResponseDto {
    return {
      id: transaction.id,
      portfolioId: transaction.portfolioId,
      symbol: transaction.symbol,
      type: transaction.type as TransactionType,
      price: Number(transaction.price),
      quantity: Number(transaction.quantity),
      total: Number(transaction.total),
      fees: Number(transaction.fees),
      notes: transaction.notes,
      date: transaction.date,
      executedAt: transaction.executedAt,
      createdAt: transaction.createdAt,
    };
  }
}
