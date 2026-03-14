import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Strategy rules from user's spreadsheet (Stock, 52w High, dip levels with threshold, buy qty, weekly dip)
const PREDEFINED_STRATEGY = [
  { symbol: 'NVDA', fiftyTwoWeekHigh: 212.19, levels: [
    { dipPercent: 10, threshold: 190.97, buy: 74, weeklyDip: null },
    { dipPercent: 15, threshold: 180.36, buy: 74, weeklyDip: null },
    { dipPercent: 20, threshold: 169.75, buy: 222, weeklyDip: null },
    { dipPercent: 30, threshold: 148.53, buy: 369, weeklyDip: 74 },
    { dipPercent: 31, threshold: 148.53, buy: 369, weeklyDip: 74 },
  ]},
  { symbol: 'PLTR', fiftyTwoWeekHigh: 207.52, levels: [
    { dipPercent: 10, threshold: 186.77, buy: 59, weeklyDip: null },
    { dipPercent: 15, threshold: 176.39, buy: 59, weeklyDip: null },
    { dipPercent: 20, threshold: 166.02, buy: 177, weeklyDip: null },
    { dipPercent: 30, threshold: 145.26, buy: 295, weeklyDip: 59 },
    { dipPercent: 31, threshold: 145.26, buy: 295, weeklyDip: 59 },
  ]},
  { symbol: 'SOFI', fiftyTwoWeekHigh: 32.73, levels: [
    { dipPercent: 10, threshold: 29.46, buy: 44, weeklyDip: null },
    { dipPercent: 15, threshold: 27.82, buy: 44, weeklyDip: null },
    { dipPercent: 20, threshold: 26.18, buy: 133, weeklyDip: null },
    { dipPercent: 30, threshold: 22.91, buy: 222, weeklyDip: 44 },
    { dipPercent: 31, threshold: 22.91, buy: 222, weeklyDip: 44 },
  ]},
  { symbol: 'FTNT', fiftyTwoWeekHigh: 114.82, levels: [
    { dipPercent: 10, threshold: 103.34, buy: 44, weeklyDip: null },
    { dipPercent: 15, threshold: 97.60, buy: 44, weeklyDip: null },
    { dipPercent: 20, threshold: 91.86, buy: 133, weeklyDip: null },
    { dipPercent: 30, threshold: 80.37, buy: 222, weeklyDip: 44 },
    { dipPercent: 31, threshold: 80.37, buy: 222, weeklyDip: 44 },
  ]},
  { symbol: 'VONG', fiftyTwoWeekHigh: 126.83, levels: [
    { dipPercent: 10, threshold: 114.15, buy: 74, weeklyDip: null },
    { dipPercent: 15, threshold: 107.81, buy: 222, weeklyDip: 74 },
    { dipPercent: 20, threshold: 101.46, buy: 369, weeklyDip: 74 },
    { dipPercent: 30, threshold: 88.78, buy: 369, weeklyDip: 74 },
    { dipPercent: 31, threshold: 88.78, buy: 369, weeklyDip: 74 },
  ]},
];

function getPredefinedStrategyRules(portfolioId: string) {
  const rules: { portfolioId: string; symbol: string; fiftyTwoWeekHigh: number; dipPercent: number; thresholdPrice: number; buyQuantity: number; weeklyDipQuantity: number | null }[] = [];
  for (const stock of PREDEFINED_STRATEGY) {
    for (const level of stock.levels) {
      rules.push({
        portfolioId,
        symbol: stock.symbol,
        fiftyTwoWeekHigh: stock.fiftyTwoWeekHigh,
        dipPercent: level.dipPercent,
        thresholdPrice: level.threshold,
        buyQuantity: level.buy,
        weeklyDipQuantity: level.weeklyDip,
      });
    }
  }
  return rules;
}

function getStrategyRulesFromExcel(workbook: XLSX.WorkBook, portfolioId: string): { portfolioId: string; symbol: string; fiftyTwoWeekHigh: number; dipPercent: number; thresholdPrice: number; buyQuantity: number; weeklyDipQuantity: number | null }[] {
  const strategySheet = workbook.Sheets['Strategy'] || workbook.Sheets['strategy'];
  if (!strategySheet) return [];

  const data = XLSX.utils.sheet_to_json(strategySheet, { header: 1 }) as any[][];
  if (!data || data.length < 2) return [];

  // Try to parse Strategy sheet - structure may vary
  const rules: { portfolioId: string; symbol: string; fiftyTwoWeekHigh: number; dipPercent: number; thresholdPrice: number; buyQuantity: number; weeklyDipQuantity: number | null }[] = [];
  const header = data[0] as string[];

  // Look for columns: Stock, 52-Week High, and dip level columns
  const symbolIdx = header.findIndex((h: string) => /stock/i.test(String(h || '')));
  const high52Idx = header.findIndex((h: string) => /52.*high|high.*52/i.test(String(h || '')));

  if (symbolIdx < 0 || high52Idx < 0) return [];

  for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx];
    const symbol = row[symbolIdx]?.toString().trim();
    const fiftyTwoWeekHigh = parseFloat(row[high52Idx] || '0');
    if (!symbol || !fiftyTwoWeekHigh) continue;

    // Parse dip levels from columns - structure depends on Excel layout
    const dipLevels = [10, 15, 20, 30, 31];
    for (let i = 0; i < dipLevels.length; i++) {
      const dipPercent = dipLevels[i];
      const thresholdCol = high52Idx + 1 + i * 3; // Approximate: threshold, buy, weeklyDip per level
      const buyCol = high52Idx + 2 + i * 3;
      const weeklyDipCol = high52Idx + 3 + i * 3;

      const threshold = parseFloat(row[thresholdCol] || '0') || fiftyTwoWeekHigh * (1 - dipPercent / 100);
      const buy = parseInt(row[buyCol] || '0', 10);
      const weeklyDip = row[weeklyDipCol] === 'NA' || row[weeklyDipCol] === '' ? null : parseInt(row[weeklyDipCol] || '0', 10) || null;

      if (buy > 0) {
        rules.push({
          portfolioId,
          symbol: symbol.toUpperCase(),
          fiftyTwoWeekHigh,
          dipPercent,
          thresholdPrice: threshold,
          buyQuantity: buy,
          weeklyDipQuantity: weeklyDip,
        });
      }
    }
  }
  return rules;
}

// Helper to convert Excel date serial number to JS Date
function excelDateToJSDate(serial: number): Date {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
}

async function main() {
  console.log('Seeding database...\n');

  // Clean existing data
  console.log('Clearing existing data...');
  await prisma.strategyRule.deleteMany();
  await prisma.buyPlan.deleteMany();
  await prisma.strategySnapshot.deleteMany();
  await prisma.weeklyBudget.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.allocation.deleteMany();
  await prisma.coreStock.deleteMany();
  await prisma.priceDaily.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.user.deleteMany();
  await prisma.globalConfig.deleteMany();
  console.log('✓ Data cleared\n');

  try {
    // Check if Excel file exists
    const excelPath = path.join(__dirname, '../../Stocks Strategy.xlsx');
    const excelExists = fs.existsSync(excelPath);
    
    if (!excelExists) {
      console.log('⚠️  Excel file not found. Creating demo data instead.\n');
      await seedDemoData();
      return;
    }
    
    console.log('📊 Excel file found. Importing real portfolio data...\n');
    
    // Read the Excel file
    const workbook = XLSX.readFile(excelPath);
    
    // Create demo user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await prisma.user.create({
      data: {
        email: 'demo@capitalforge.com',
        password: hashedPassword,
        name: 'Demo User',
      },
    });
    console.log('✓ Created user:', user.email);

    // Get total capital from Excel (support multiple sheet name variations)
    const allocationsSheet =
      workbook.Sheets['Stockes Allocations'] ||
      workbook.Sheets['Stock Allocation'] ||
      workbook.Sheets['Stocks Allocations'];
    if (!allocationsSheet) {
      throw new Error('Allocation sheet not found. Expected: "Stockes Allocations", "Stock Allocation", or "Stocks Allocations"');
    }
    const allocationsData = XLSX.utils.sheet_to_json(allocationsSheet) as any[];
    const totalCapital = allocationsData[0]?.['Total (USD)'] ?? allocationsData[0]?.['Total (USD) '] ?? 23639;
    
    // Create portfolio (strategyReferenceBudget = budget strategy was designed for; used for scaling when totalCapital changes)
    const portfolio = await prisma.portfolio.create({
      data: {
        userId: user.id,
        name: 'My Portfolio',
        description: 'Real portfolio imported from Excel',
        totalCapital: totalCapital,
        strategyReferenceBudget: totalCapital, // strategy designed for this budget
        currency: 'USD',
      },
    });
    console.log(`✓ Created portfolio: ${portfolio.name} ($${totalCapital.toLocaleString()})\n`);

    // ========== Import Allocations ==========
    console.log('Importing allocations...');
    let allocationsCreated = 0;
    
    for (const row of allocationsData) {
      const symbol = (row['Stock '] ?? row['Stock'])?.toString().trim();
      const targetPercentage = parseFloat(row['Allocation(%)'] ?? row['Allocation (%)'] ?? '0');
      if (!symbol || isNaN(targetPercentage) || targetPercentage <= 0) continue;

      const allocationUSD = (totalCapital * targetPercentage) / 100;
      const coreBucketUSD = allocationUSD * 0.6;
      const dipBucketUSD = allocationUSD * 0.4;
      const crashBucketUSD = allocationUSD * 0;
      const monthlyDCA = coreBucketUSD / 12;
      const weeklyDCA = coreBucketUSD / 48;

      await prisma.allocation.create({
        data: {
          portfolioId: portfolio.id,
          symbol: symbol.toUpperCase(),
          companyName: null,
          targetPercentage: targetPercentage,
          allocationUSD,
          coreBucketUSD,
          dipBucketUSD,
          crashBucketUSD,
          monthlyDCA,
          weeklyDCA,
          coreRemainingUSD: coreBucketUSD,
          dipRemainingUSD: dipBucketUSD,
          crashRemainingUSD: crashBucketUSD,
          sharesOwned: 0,
          avgCostBasis: 0,
          investedValue: 0,
        },
      });
      
      allocationsCreated++;
      console.log(`  ✓ ${symbol} - ${targetPercentage}%`);
    }
    console.log(`✓ Created ${allocationsCreated} allocations\n`);

    // ========== Populate Core Stocks from Allocations ==========
    const allocationSymbols = await prisma.allocation.findMany({
      where: { portfolioId: portfolio.id },
      select: { symbol: true, companyName: true },
    });
    for (const a of allocationSymbols) {
      await prisma.coreStock.upsert({
        where: { portfolioId_symbol: { portfolioId: portfolio.id, symbol: a.symbol } },
        create: { portfolioId: portfolio.id, symbol: a.symbol, displayName: a.companyName },
        update: {},
      });
    }
    console.log(`✓ Created ${allocationSymbols.length} core stocks\n`);

    // ========== Import Current Positions ==========
    console.log('Importing current positions...');
    const positionsSheet = workbook.Sheets['Current Positions'];
    const positionsData = XLSX.utils.sheet_to_json(positionsSheet) as any[];
    
    for (const row of positionsData) {
      const symbol = row['Stock ']?.toString().trim();
      const units = parseFloat(row['Units'] || '0');
      const avgPrice = parseFloat(row['Avg Price'] || '0');
      const investedValue = parseFloat(row['Invested Value'] || '0');
      
      if (!symbol || units === 0) continue;

      // Update the allocation with position data
      await prisma.allocation.updateMany({
        where: {
          portfolioId: portfolio.id,
          symbol: symbol.toUpperCase(),
        },
        data: {
          sharesOwned: units,
          avgCostBasis: avgPrice,
          investedValue: investedValue,
        },
      });
      
      console.log(`  ✓ ${symbol}: ${units.toFixed(2)} shares @ $${avgPrice.toFixed(2)}`);
    }
    console.log('✓ Updated positions\n');

    // ========== Import Transactions ==========
    console.log('Importing transactions...');
    const transactionsSheet = workbook.Sheets['Transactions'];
    const transactionsData = XLSX.utils.sheet_to_json(transactionsSheet, { header: 1 }) as any[][];
    
    let transactionsCreated = 0;
    
    // The transactions sheet has a complex layout with multiple stocks side by side
    // We'll parse it column by column
    const stockColumns = [
      { symbol: 'NVDA', dateCol: 0, priceCol: 1, unitsCol: 2, totalCol: 3 },
      { symbol: 'PLTR', dateCol: 4, priceCol: 5, unitsCol: 6, totalCol: 7 },
      { symbol: 'SOFI', dateCol: 8, priceCol: 9, unitsCol: 10, totalCol: 11 },
      { symbol: 'VONG', dateCol: 12, priceCol: 13, unitsCol: 14, totalCol: 15 },
      { symbol: 'FTNT', dateCol: 16, priceCol: 17, unitsCol: 18, totalCol: 19 },
      { symbol: 'GOOGL', dateCol: 20, priceCol: 21, unitsCol: 22, totalCol: 23 },
    ];

    // Skip header row (index 0)
    for (let rowIdx = 1; rowIdx < transactionsData.length; rowIdx++) {
      const row = transactionsData[rowIdx];
      
      for (const stock of stockColumns) {
        const dateSerial = row[stock.dateCol];
        const price = parseFloat(row[stock.priceCol] || '0');
        const units = parseFloat(row[stock.unitsCol] || '0');
        const total = parseFloat(row[stock.totalCol] || '0');
        
        if (!dateSerial || !price || !units) continue;
        
        // Convert Excel date serial to JS Date
        const date = excelDateToJSDate(dateSerial);
        
        await prisma.transaction.create({
          data: {
            portfolioId: portfolio.id,
            symbol: stock.symbol,
            type: 'BUY',
            price: price,
            quantity: units,
            total: total || (price * units),
            fees: 0,
            date: date,
            notes: `Imported from Excel`,
          },
        });
        
        transactionsCreated++;
      }
    }
    console.log(`✓ Created ${transactionsCreated} transactions\n`);

    // Update allocation bucket usage based on invested value
    console.log('Updating bucket usage...');
    const portfolioAllocations = await prisma.allocation.findMany({
      where: { portfolioId: portfolio.id },
    });
    
    for (const allocation of portfolioAllocations) {
      const invested = Number(allocation.investedValue);
      const coreBucket = Number(allocation.coreBucketUSD);
      
      // Assume all invested amount came from core bucket for now
      const coreUsed = Math.min(invested, coreBucket);
      
      await prisma.allocation.update({
        where: { id: allocation.id },
        data: {
          coreUsedUSD: coreUsed,
          coreRemainingUSD: Math.max(0, coreBucket - coreUsed),
        },
      });
    }
    console.log('✓ Updated bucket usage\n');

    // Create weekly budget
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);

    // Calculate total weekly DCA from allocations
    const totalWeeklyDCA = allocationsData
      .filter(row => row['Stock '])
      .reduce((sum, row) => sum + (parseFloat(row['Weekly DCA'] || '0')), 0);

    await prisma.weeklyBudget.create({
      data: {
        portfolioId: portfolio.id,
        weekStartDate: weekStart,
        plannedAmount: Math.ceil(totalWeeklyDCA),
        usedAmount: 0,
        remainingAmount: Math.ceil(totalWeeklyDCA),
        carryForward: false,
        notes: 'Weekly DCA budget from Excel',
      },
    });
    console.log(`✓ Created weekly budget: $${Math.ceil(totalWeeklyDCA)}`);

    // Create global config (matching Excel strategy: 60/20/4)
    await prisma.globalConfig.createMany({
      data: [
        { key: 'CORE_BUCKET_RATIO', value: '0.6' },
        { key: 'DIP_BUCKET_RATIO', value: '0.4' },
        { key: 'CRASH_BUCKET_RATIO', value: '0' },
        { key: 'DIP_THRESHOLD_LIGHT', value: '10' },
        { key: 'DIP_THRESHOLD_MODERATE', value: '15' },
        { key: 'DIP_THRESHOLD_SIGNIFICANT', value: '20' },
        { key: 'DIP_THRESHOLD_CRASH', value: '30' },
      ],
    });
    console.log('✓ Created global config');

    // ========== Import Strategy Rules (from Strategy sheet / predefined) ==========
    console.log('Importing strategy rules...');
    const strategyRules = getStrategyRulesFromExcel(workbook, portfolio.id);
    if (strategyRules.length > 0) {
      await prisma.strategyRule.createMany({ data: strategyRules });
      console.log(`✓ Created ${strategyRules.length} strategy rules`);
    } else {
      // Fallback: use predefined strategy from user's spreadsheet
      const predefinedRules = getPredefinedStrategyRules(portfolio.id);
      await prisma.strategyRule.createMany({ data: predefinedRules });
      console.log(`✓ Created ${predefinedRules.length} predefined strategy rules`);
    }
    console.log('');

    console.log('\n========================================');
    console.log('Excel import completed successfully!');
    console.log('========================================');
    console.log(`Portfolio: ${portfolio.name}`);
    console.log(`Total Capital: $${totalCapital.toLocaleString()}`);
    console.log(`Allocations: ${allocationsCreated} stocks`);
    console.log(`Transactions: ${transactionsCreated} imported`);
    console.log(`Weekly Budget: $${Math.ceil(totalWeeklyDCA)}`);
    console.log(`Bucket Strategy: 60% Core / 20% Dip / 4% Crash`);
    console.log('\nDemo credentials:');
    console.log('  Email: demo@capitalforge.com');
    console.log('  Password: password123');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error seeding from Excel:', error);
    throw error;
  }
}

async function seedDemoData() {
  // Create demo user
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.create({
    data: {
      email: 'demo@capitalforge.com',
      password: hashedPassword,
      name: 'Demo User',
    },
  });
  console.log('✓ Created user:', user.email);

  // Create demo portfolio
  const portfolio = await prisma.portfolio.create({
    data: {
      userId: user.id,
      name: 'Tech Growth Portfolio',
      description: 'Demo portfolio with sample allocations',
      totalCapital: 100000,
      strategyReferenceBudget: 100000,
      currency: 'USD',
    },
  });
  console.log('✓ Created portfolio:', portfolio.name);

  // Create demo allocations
  const demoAllocations = [
    { symbol: 'AAPL', companyName: 'Apple Inc.', targetPercentage: 20 },
    { symbol: 'MSFT', companyName: 'Microsoft Corporation', targetPercentage: 20 },
    { symbol: 'GOOGL', companyName: 'Alphabet Inc.', targetPercentage: 15 },
    { symbol: 'NVDA', companyName: 'NVIDIA Corporation', targetPercentage: 15 },
    { symbol: 'AMZN', companyName: 'Amazon.com Inc.', targetPercentage: 15 },
    { symbol: 'META', companyName: 'Meta Platforms Inc.', targetPercentage: 10 },
    { symbol: 'TSLA', companyName: 'Tesla Inc.', targetPercentage: 5 },
  ];

  for (const alloc of demoAllocations) {
    const allocationUSD = (Number(portfolio.totalCapital) * alloc.targetPercentage) / 100;
    const coreBucketUSD = allocationUSD * 0.6;
    const dipBucketUSD = allocationUSD * 0.4;
    const crashBucketUSD = allocationUSD * 0;
    const monthlyDCA = coreBucketUSD / 12;
    const weeklyDCA = coreBucketUSD / 48;

    await prisma.allocation.create({
      data: {
        portfolioId: portfolio.id,
        symbol: alloc.symbol,
        companyName: alloc.companyName,
        targetPercentage: alloc.targetPercentage,
        allocationUSD,
        coreBucketUSD,
        dipBucketUSD,
        crashBucketUSD,
        monthlyDCA,
        weeklyDCA,
        coreRemainingUSD: coreBucketUSD,
        dipRemainingUSD: dipBucketUSD,
        crashRemainingUSD: crashBucketUSD,
        sharesOwned: 0,
        avgCostBasis: 0,
        investedValue: 0,
      },
    });
  }
  console.log(`✓ Created ${demoAllocations.length} demo allocations`);

  // Populate core stocks from allocations
  for (const alloc of demoAllocations) {
    await prisma.coreStock.upsert({
      where: { portfolioId_symbol: { portfolioId: portfolio.id, symbol: alloc.symbol } },
      create: { portfolioId: portfolio.id, symbol: alloc.symbol, displayName: alloc.companyName },
      update: {},
    });
  }
  console.log(`✓ Created ${demoAllocations.length} core stocks`);

  // Create weekly budget
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  await prisma.weeklyBudget.create({
    data: {
      portfolioId: portfolio.id,
      weekStartDate: weekStart,
      plannedAmount: 2000,
      usedAmount: 0,
      remainingAmount: 2000,
      carryForward: false,
      notes: 'Weekly DCA budget',
    },
  });
  console.log('✓ Created weekly budget');

  // Create global config
  await prisma.globalConfig.createMany({
    data: [
      { key: 'CORE_BUCKET_RATIO', value: '0.6' },
      { key: 'DIP_BUCKET_RATIO', value: '0.4' },
      { key: 'CRASH_BUCKET_RATIO', value: '0' },
      { key: 'DIP_THRESHOLD_LIGHT', value: '10' },
      { key: 'DIP_THRESHOLD_MODERATE', value: '15' },
      { key: 'DIP_THRESHOLD_SIGNIFICANT', value: '20' },
      { key: 'DIP_THRESHOLD_CRASH', value: '30' },
    ],
  });
  console.log('✓ Created global config');

  console.log('\n========================================');
  console.log('Demo data seeded successfully!');
  console.log('========================================');
  console.log('Demo credentials:');
  console.log('  Email: demo@capitalforge.com');
  console.log('  Password: password123');
  console.log('========================================\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
