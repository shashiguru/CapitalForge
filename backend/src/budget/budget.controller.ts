import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BudgetService } from './budget.service';
import {
  CreateWeeklyBudgetDto,
  UpdateWeeklyBudgetDto,
  WeeklyBudgetResponseDto,
  BudgetSummaryDto,
} from './dto/budget.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('portfolios/:portfolioId/budgets')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWeeklyBudgetDto,
  ): Promise<WeeklyBudgetResponseDto> {
    return this.budgetService.create(portfolioId, userId, dto);
  }

  @Get()
  async findAll(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<WeeklyBudgetResponseDto[]> {
    return this.budgetService.findAll(portfolioId, userId);
  }

  @Get('current')
  async getCurrentWeek(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<WeeklyBudgetResponseDto | null> {
    return this.budgetService.getCurrentWeekBudget(portfolioId, userId);
  }

  @Get('summary')
  async getSummary(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<BudgetSummaryDto> {
    return this.budgetService.getSummary(portfolioId, userId);
  }
}

@Controller('budgets')
export class BudgetItemController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<WeeklyBudgetResponseDto> {
    return this.budgetService.findOne(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateWeeklyBudgetDto,
  ): Promise<WeeklyBudgetResponseDto> {
    return this.budgetService.update(id, userId, dto);
  }
}
