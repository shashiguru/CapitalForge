import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }
    
    // Delete in order respecting foreign key constraints
    await this.buyPlan.deleteMany();
    await this.strategySnapshot.deleteMany();
    await this.weeklyBudget.deleteMany();
    await this.transaction.deleteMany();
    await this.allocation.deleteMany();
    await this.priceDaily.deleteMany();
    await this.portfolio.deleteMany();
    await this.user.deleteMany();
    await this.globalConfig.deleteMany();
  }
}
