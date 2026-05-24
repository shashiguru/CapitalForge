const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const presets = await prisma.budgetPreset.findMany({ include: { stocks: true } });
  for (const preset of presets) {
    if (preset.stocks.length > 0) {
      console.log(`Skip ${preset.name} — already has ${preset.stocks.length} stocks`);
      continue;
    }
    const allocs = await prisma.allocation.findMany({
      where: { portfolioId: preset.portfolioId, isActive: true },
      orderBy: { symbol: 'asc' },
    });
    if (allocs.length === 0) {
      console.log(`Skip ${preset.name} — no active allocations`);
      continue;
    }
    await prisma.budgetPresetStock.createMany({
      data: allocs.map((a, i) => ({
        budgetPresetId: preset.id,
        symbol: a.symbol,
        companyName: a.companyName,
        targetPercentage: a.targetPercentage,
        isAggressive: a.isAggressive,
        fiftyTwoWeekHigh: a.fiftyTwoWeekHigh,
        sortOrder: i,
      })),
    });
    console.log(`Seeded ${preset.name} with ${allocs.length} stocks`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
