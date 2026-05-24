import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import {
  CreatePortfolioDto,
  UpdatePortfolioDto,
  PortfolioResponseDto,
  PortfolioSummaryDto,
} from './dto/portfolio.dto';
import { CreateBudgetPresetDto, UpdateBudgetPresetDto } from './dto/budget-preset.dto';
import { SaveBudgetPresetCompositionDto } from './dto/budget-preset-composition.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('portfolios')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  // Budget preset routes - must come before :id routes to avoid path conflicts
  @Get(':id/budget-presets')
  async getBudgetPresets(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.portfolioService.getBudgetPresets(id, userId);
  }

  @Post(':id/budget-presets')
  @HttpCode(HttpStatus.CREATED)
  async createBudgetPreset(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBudgetPresetDto,
  ) {
    return this.portfolioService.createBudgetPreset(id, userId, dto);
  }

  @Patch(':id/budget-presets/:presetId')
  async updateBudgetPreset(
    @Param('id') id: string,
    @Param('presetId') presetId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateBudgetPresetDto,
  ) {
    return this.portfolioService.updateBudgetPreset(id, presetId, userId, dto);
  }

  @Post(':id/budget-presets/:presetId/apply')
  async applyBudgetPreset(
    @Param('id') id: string,
    @Param('presetId') presetId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.portfolioService.applyBudgetPreset(id, presetId, userId);
  }

  @Get(':id/budget-presets/:presetId/composition')
  async getBudgetPresetComposition(
    @Param('id') id: string,
    @Param('presetId') presetId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.portfolioService.getBudgetPresetComposition(id, presetId, userId);
  }

  @Put(':id/budget-presets/:presetId/composition')
  async saveBudgetPresetComposition(
    @Param('id') id: string,
    @Param('presetId') presetId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SaveBudgetPresetCompositionDto,
  ) {
    return this.portfolioService.saveBudgetPresetComposition(id, presetId, userId, dto);
  }

  @Delete(':id/budget-presets/:presetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBudgetPreset(
    @Param('id') id: string,
    @Param('presetId') presetId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.portfolioService.deleteBudgetPreset(id, presetId, userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePortfolioDto,
  ): Promise<PortfolioResponseDto> {
    return this.portfolioService.create(userId, dto);
  }

  @Get()
  async findAll(@CurrentUser('id') userId: string): Promise<PortfolioResponseDto[]> {
    return this.portfolioService.findAll(userId);
  }

  @Get(':id/summary')
  async getSummary(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<PortfolioSummaryDto> {
    return this.portfolioService.getSummary(id, userId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<PortfolioResponseDto> {
    return this.portfolioService.findOne(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePortfolioDto,
  ): Promise<PortfolioResponseDto> {
    return this.portfolioService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.portfolioService.remove(id, userId);
  }
}
