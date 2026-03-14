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

// Type alias for Prisma compatibility
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

    // Update allocation if BUY or SELL
    if (dto.type === TransactionType.BUY || dto.type === TransactionType.SELL) {
      await this.updateAllocationFromTransaction(
        portfolioId,
        symbol,
        dto.type,
        dto.price,
        dto.quantity,
      );
    }

    // Deduct from budget if BUY
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

    if (filter?.symbol) {
      where.symbol = filter.symbol.toUpperCase();
    }

    if (filter?.type) {
      where.type = filter.type;
    }

    if (filter?.startDate || filter?.endDate) {
      where.date = {};
      if (filter.startDate) {
        where.date.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        where.date.lte = new Date(filter.endDate);
      }
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return transactions.map((t) => this.mapToResponse(t));
  }

  async findOne(
    id: string,
    userId: string,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: { portfolio: true },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    await this.portfolioService.validateOwnership(
      transaction.portfolioId,
      userId,
    );

    return this.mapToResponse(transaction);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    await this.portfolioService.validateOwnership(
      transaction.portfolioId,
      userId,
    );

    const price = dto.price ?? Number(transaction.price);
    const quantity = dto.quantity ?? Number(transaction.quantity);
    const total = price * quantity;

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.symbol !== undefined && { symbol: dto.symbol.toUpperCase() }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.price !== undefined || dto.quantity !== undefined
          ? { total }
          : {}),
        ...(dto.fees !== undefined && { fees: dto.fees }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
      },
    });

    return this.mapToResponse(updated);
  }

  async remove(id: string, userId: string): Promise<void> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    await this.portfolioService.validateOwnership(
      transaction.portfolioId,
      userId,
    );

    await this.prisma.transaction.delete({
      where: { id },
    });
  }

  async bulkImport(
    portfolioId: string,
    userId: string,
    dto: BulkImportDto,
  ): Promise<TransactionResponseDto[]> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const results: TransactionResponseDto[] = [];

    for (const item of dto.transactions) {
      const transaction = await this.create(portfolioId, userId, {
        ...item,
        notes: 'Imported',
      });
      results.push(transaction);
    }

    return results;
  }

  async getSummary(
    portfolioId: string,
    userId: string,
  ): Promise<TransactionSummaryDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const transactions = await this.prisma.transaction.findMany({
      where: { portfolioId },
    });

    let totalBuys = 0;
    let totalSells = 0;
    let totalDividends = 0;
    let totalFees = 0;

    for (const t of transactions) {
      const total = Number(t.total);
      const fees = Number(t.fees);

      switch (t.type) {
        case 'BUY':
          totalBuys += total;
          break;
        case 'SELL':
          totalSells += total;
          break;
        case 'DIVIDEND':
          totalDividends += total;
          break;
        case 'FEE':
          totalFees += total;
          break;
      }
      totalFees += fees;
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

  private async updateAllocationFromTransaction(
    portfolioId: string,
    symbol: string,
    type: TransactionType,
    price: number,
    quantity: number,
  ): Promise<void> {
    const allocation = await this.prisma.allocation.findUnique({
      where: {
        portfolioId_symbol: { portfolioId, symbol },
      },
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

      await this.prisma.allocation.update({
        where: { id: allocation.id },
        data: {
          sharesOwned: newShares,
          avgCostBasis: newCostBasis,
        },
      });
    } else if (type === TransactionType.SELL) {
      const newShares = Math.max(0, currentShares - quantity);

      await this.prisma.allocation.update({
        where: { id: allocation.id },
        data: {
          sharesOwned: newShares,
        },
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
