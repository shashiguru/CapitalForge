import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyData() {
  console.log('Verifying imported data...\n');

  try {
    // Check users
    const users = await prisma.user.findMany();
    console.log(`✓ Users: ${users.length}`);
    users.forEach(u => console.log(`  - ${u.email}`));

    // Check portfolios
    const portfolios = await prisma.portfolio.findMany();
    console.log(`\n✓ Portfolios: ${portfolios.length}`);
    portfolios.forEach(p => console.log(`  - ${p.name}: $${Number(p.totalCapital).toLocaleString()}`));

    // Check allocations
    const allocations = await prisma.allocation.findMany({
      orderBy: { targetPercentage: 'desc' },
    });
    console.log(`\n✓ Allocations: ${allocations.length}`);
    allocations.forEach(a => {
      const invested = Number(a.investedValue);
      const shares = Number(a.sharesOwned);
      const avgCost = Number(a.avgCostBasis);
      console.log(`  - ${a.symbol}: ${a.targetPercentage}% | ${shares.toFixed(2)} shares @ $${avgCost.toFixed(2)} = $${invested.toFixed(2)}`);
    });

    // Check transactions
    const transactions = await prisma.transaction.findMany({
      orderBy: { date: 'desc' },
      take: 10,
    });
    console.log(`\n✓ Transactions: ${await prisma.transaction.count()} total`);
    console.log('  Latest 10:');
    transactions.forEach(t => {
      console.log(`  - ${t.date.toISOString().split('T')[0]} | ${t.symbol} | ${t.type} | ${Number(t.quantity).toFixed(2)} @ $${Number(t.price).toFixed(2)}`);
    });

    // Check weekly budget
    const budgets = await prisma.weeklyBudget.findMany();
    console.log(`\n✓ Weekly Budgets: ${budgets.length}`);
    budgets.forEach(b => {
      console.log(`  - Week of ${b.weekStartDate.toISOString().split('T')[0]}: $${Number(b.plannedAmount)} planned, $${Number(b.remainingAmount)} remaining`);
    });

    // Check global config
    const configs = await prisma.globalConfig.findMany();
    console.log(`\n✓ Global Config: ${configs.length} settings`);
    configs.forEach(c => console.log(`  - ${c.key}: ${c.value}`));

    // Calculate portfolio summary
    const totalInvested = allocations.reduce((sum, a) => sum + Number(a.investedValue), 0);
    const totalShares = allocations.reduce((sum, a) => sum + Number(a.sharesOwned), 0);
    
    console.log('\n========================================');
    console.log('Portfolio Summary');
    console.log('========================================');
    console.log(`Total Capital: $${Number(portfolios[0]?.totalCapital || 0).toLocaleString()}`);
    console.log(`Total Invested: $${totalInvested.toLocaleString()}`);
    console.log(`Total Shares: ${totalShares.toFixed(2)}`);
    console.log(`Stocks: ${allocations.length}`);
    console.log(`Transactions: ${await prisma.transaction.count()}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Error verifying data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyData();
