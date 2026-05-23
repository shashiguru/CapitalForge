import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import {
  CreateWeeklyBudgetDto,
  UpdateWeeklyBudgetDto,
  WeeklyBudgetResponseDto,
  BudgetSummaryDto,
} from './dto/budget.dto';

@Injectable()
export class BudgetService {
  constructor(
    private prisma: PrismaService,
    private portfolioService: PortfolioService,
  ) {}

  async create(
    portfolioId: string,
    userId: string,
    dto: CreateWeeklyBudgetDto,
  ): Promise<WeeklyBudgetResponseDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const weekStartDate = dto.weekStartDate
      ? new Date(dto.weekStartDate)
      : this.getWeekStartDate(new Date());

    // Check if budget already exists for this week
    const existing = await this.prisma.weeklyBudget.findUnique({
      where: {
        portfolioId_weekStartDate: {
          portfolioId,
          weekStartDate,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Budget already exists for this week. Update the existing budget instead.',
      );
    }

    // Check for carry forward from previous week
    let carryForwardAmount = 0;
    if (dto.carryForward) {
      const previousWeek = new Date(weekStartDate);
      previousWeek.setDate(previousWeek.getDate() - 7);

      const previousBudget = await this.prisma.weeklyBudget.findUnique({
        where: {
          portfolioId_weekStartDate: {
            portfolioId,
            weekStartDate: previousWeek,
          },
        },
      });

      if (previousBudget && Number(previousBudget.remainingAmount) > 0) {
        carryForwardAmount = Number(previousBudget.remainingAmount);
      }
    }

    const totalPlanned = dto.plannedAmount + carryForwardAmount;

    const budget = await this.prisma.weeklyBudget.create({
      data: {
        portfolioId,
        weekStartDate,
        plannedAmount: totalPlanned,
        usedAmount: 0,
        remainingAmount: totalPlanned,
        carryForward: dto.carryForward || false,
        notes: dto.notes,
      },
    });

    return this.mapToResponse(budget);
  }

  async findAll(
    portfolioId: string,
    userId: string,
  ): Promise<WeeklyBudgetResponseDto[]> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const budgets = await this.prisma.weeklyBudget.findMany({
      where: { portfolioId },
      orderBy: { weekStartDate: 'desc' },
    });

    return budgets.map((b) => this.mapToResponse(b));
  }

  async findOne(
    id: string,
    userId: string,
  ): Promise<WeeklyBudgetResponseDto> {
    const budget = await this.prisma.weeklyBudget.findUnique({
      where: { id },
      include: { portfolio: true },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    await this.portfolioService.validateOwnership(budget.portfolioId, userId);

    return this.mapToResponse(budget);
  }

  async getCurrentWeekBudget(
    portfolioId: string,
    userId: string,
  ): Promise<WeeklyBudgetResponseDto | null> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const weekStartDate = this.getWeekStartDate(new Date());

    const budget = await this.prisma.weeklyBudget.findUnique({
      where: {
        portfolioId_weekStartDate: {
          portfolioId,
          weekStartDate,
        },
      },
    });

    return budget ? this.mapToResponse(budget) : null;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateWeeklyBudgetDto,
  ): Promise<WeeklyBudgetResponseDto> {
    const budget = await this.prisma.weeklyBudget.findUnique({
      where: { id },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    await this.portfolioService.validateOwnership(budget.portfolioId, userId);

    const updateData: any = {};

    if (dto.plannedAmount !== undefined) {
      updateData.plannedAmount = dto.plannedAmount;
      // Recalculate remaining amount
      updateData.remainingAmount = dto.plannedAmount - Number(budget.usedAmount);
    }

    if (dto.carryForward !== undefined) {
      updateData.carryForward = dto.carryForward;
    }

    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    const updated = await this.prisma.weeklyBudget.update({
      where: { id },
      data: updateData,
    });

    return this.mapToResponse(updated);
  }

  async getSummary(
    portfolioId: string,
    userId: string,
  ): Promise<BudgetSummaryDto> {
    await this.portfolioService.validateOwnership(portfolioId, userId);

    const currentWeekStart = this.getWeekStartDate(new Date());
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Get current week budget
    const currentWeekBudget = await this.prisma.weeklyBudget.findUnique({
      where: {
        portfolioId_weekStartDate: {
          portfolioId,
          weekStartDate: currentWeekStart,
        },
      },
    });

    // Get all budgets for this month
    const monthlyBudgets = await this.prisma.weeklyBudget.findMany({
      where: {
        portfolioId,
        weekStartDate: { gte: monthStart },
      },
    });

    const totalBudgetedThisMonth = monthlyBudgets.reduce(
      (sum, b) => sum + Number(b.plannedAmount),
      0,
    );
    const totalUsedThisMonth = monthlyBudgets.reduce(
      (sum, b) => sum + Number(b.usedAmount),
      0,
    );

    // Get average weekly budget (all time)
    const allBudgets = await this.prisma.weeklyBudget.findMany({
      where: { portfolioId },
    });

    const averageWeeklyBudget =
      allBudgets.length > 0
        ? allBudgets.reduce((sum, b) => sum + Number(b.plannedAmount), 0) /
          allBudgets.length
        : 0;

    return {
      currentWeekBudget: currentWeekBudget
        ? this.mapToResponse(currentWeekBudget)
        : null,
      totalBudgetedThisMonth,
      totalUsedThisMonth,
      averageWeeklyBudget,
      totalWeeks: allBudgets.length,
    };
  }

  async restoreToBudget(
    portfolioId: string,
    amount: number,
  ): Promise<void> {
    const weekStartDate = this.getWeekStartDate(new Date());

    const budget = await this.prisma.weeklyBudget.findUnique({
      where: { portfolioId_weekStartDate: { portfolioId, weekStartDate } },
    });

    if (budget) {
      await this.prisma.weeklyBudget.update({
        where: { id: budget.id },
        data: {
          usedAmount: { decrement: amount },
          remainingAmount: { increment: amount },
        },
      });
    }
  }

  async deductFromBudget(
    portfolioId: string,
    amount: number,
  ): Promise<void> {
    const weekStartDate = this.getWeekStartDate(new Date());

    const budget = await this.prisma.weeklyBudget.findUnique({
      where: {
        portfolioId_weekStartDate: {
          portfolioId,
          weekStartDate,
        },
      },
    });

    if (budget) {
      await this.prisma.weeklyBudget.update({
        where: { id: budget.id },
        data: {
          usedAmount: { increment: amount },
          remainingAmount: { decrement: amount },
        },
      });
    }
  }

  private getWeekStartDate(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private mapToResponse(budget: any): WeeklyBudgetResponseDto {
    const plannedAmount = Number(budget.plannedAmount);
    const usedAmount = Number(budget.usedAmount);
    const remainingAmount = Number(budget.remainingAmount);
    const utilizationPercent =
      plannedAmount > 0 ? (usedAmount / plannedAmount) * 100 : 0;

    return {
      id: budget.id,
      portfolioId: budget.portfolioId,
      weekStartDate: budget.weekStartDate,
      plannedAmount,
      usedAmount,
      remainingAmount,
      carryForward: budget.carryForward,
      notes: budget.notes,
      utilizationPercent,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }
}
