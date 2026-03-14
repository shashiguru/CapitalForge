import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StrategyService } from './strategy.service';
import {
  GenerateStrategyDto,
  StrategySnapshotDto,
  BuyPlanDto,
  ExecuteBuyPlanDto,
  ApproveBuyPlanDto,
  PortfolioStrategyTableDto,
  StoredStrategyRulesDto,
} from './dto/strategy.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('portfolios/:portfolioId/strategy')
export class StrategyController {
  constructor(private readonly strategyService: StrategyService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generateStrategy(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateStrategyDto,
  ): Promise<StrategySnapshotDto> {
    return this.strategyService.generateStrategy(portfolioId, userId, dto);
  }

  @Get('snapshots')
  async getSnapshots(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StrategySnapshotDto[]> {
    return this.strategyService.getSnapshots(portfolioId, userId);
  }

  @Get('snapshots/:snapshotId')
  async getSnapshot(
    @Param('snapshotId') snapshotId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StrategySnapshotDto> {
    return this.strategyService.getSnapshot(snapshotId, userId);
  }

  @Get('table')
  async getStrategyTable(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<PortfolioStrategyTableDto> {
    return this.strategyService.getStrategyTable(portfolioId, userId);
  }

  @Get('rules')
  async getStrategyRules(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StoredStrategyRulesDto> {
    return this.strategyService.getStrategyRules(portfolioId, userId);
  }
}

@Controller('buy-plans')
export class BuyPlanController {
  constructor(private readonly strategyService: StrategyService) {}

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approveBuyPlan(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ApproveBuyPlanDto,
  ): Promise<BuyPlanDto> {
    return this.strategyService.approveBuyPlan(id, userId, dto.approved);
  }

  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  async executeBuyPlan(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ExecuteBuyPlanDto,
  ): Promise<BuyPlanDto> {
    return this.strategyService.executeBuyPlan(id, userId, dto);
  }
}
