import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearData() {
  console.log('Clearing all data from database...\n');

  try {
    // Delete in reverse order of dependencies
    await prisma.strategyRule.deleteMany();
    console.log('✓ Cleared strategy_rules');

    await prisma.buyPlan.deleteMany();
    console.log('✓ Cleared buy_plans');

    await prisma.strategySnapshot.deleteMany();
    console.log('✓ Cleared strategy_snapshots');

    await prisma.weeklyBudget.deleteMany();
    console.log('✓ Cleared weekly_budgets');

    await prisma.transaction.deleteMany();
    console.log('✓ Cleared transactions');

    await prisma.allocation.deleteMany();
    console.log('✓ Cleared allocations');

    await prisma.priceDaily.deleteMany();
    console.log('✓ Cleared prices_daily');

    await prisma.portfolio.deleteMany();
    console.log('✓ Cleared portfolios');

    await prisma.user.deleteMany();
    console.log('✓ Cleared users');

    await prisma.globalConfig.deleteMany();
    console.log('✓ Cleared global_config');

    console.log('\n========================================');
    console.log('All data cleared successfully!');
    console.log('========================================\n');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
