import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AllocationService } from './allocation.service';
import {
  CreateAllocationDto,
  UpdateAllocationDto,
  AllocationResponseDto,
  AllocationSummaryDto,
  BulkUpdateAllocationDto,
} from './dto/allocation.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('portfolios/:portfolioId/allocations')
export class AllocationController {
  constructor(private readonly allocationService: AllocationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAllocationDto,
  ): Promise<AllocationResponseDto> {
    return this.allocationService.create(portfolioId, userId, dto);
  }

  @Get()
  async findAll(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<AllocationResponseDto[]> {
    return this.allocationService.findAll(portfolioId, userId);
  }

  @Get('summary')
  async getSummary(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<AllocationSummaryDto> {
    return this.allocationService.getSummary(portfolioId, userId);
  }

  @Post('bulk')
  async bulkUpdate(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
    @Body() allocations: BulkUpdateAllocationDto[],
  ): Promise<AllocationResponseDto[]> {
    return this.allocationService.bulkUpdate(portfolioId, userId, allocations);
  }

  @Post('recalculate')
  @HttpCode(HttpStatus.OK)
  async recalculateBuckets(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<{ message: string }> {
    await this.allocationService.recalculateBuckets(portfolioId);
    return { message: 'Buckets recalculated successfully' };
  }
}

@Controller('allocations')
export class AllocationItemController {
  constructor(private readonly allocationService: AllocationService) {}

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<AllocationResponseDto> {
    return this.allocationService.findOne(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateAllocationDto,
  ): Promise<AllocationResponseDto> {
    return this.allocationService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.allocationService.remove(id, userId);
  }
}
