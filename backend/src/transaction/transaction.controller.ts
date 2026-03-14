import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  TransactionResponseDto,
  TransactionFilterDto,
  BulkImportDto,
  TransactionSummaryDto,
} from './dto/transaction.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('portfolios/:portfolioId/transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionService.create(portfolioId, userId, dto);
  }

  @Get()
  async findAll(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
    @Query() filter: TransactionFilterDto,
  ): Promise<TransactionResponseDto[]> {
    return this.transactionService.findAll(portfolioId, userId, filter);
  }

  @Get('summary')
  async getSummary(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
  ): Promise<TransactionSummaryDto> {
    return this.transactionService.getSummary(portfolioId, userId);
  }

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  async bulkImport(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: BulkImportDto,
  ): Promise<TransactionResponseDto[]> {
    return this.transactionService.bulkImport(portfolioId, userId, dto);
  }
}

@Controller('transactions')
export class TransactionItemController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<TransactionResponseDto> {
    return this.transactionService.findOne(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.transactionService.remove(id, userId);
  }
}
