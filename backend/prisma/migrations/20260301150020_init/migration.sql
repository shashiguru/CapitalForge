-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'FEE');

-- CreateEnum
CREATE TYPE "DipLevel" AS ENUM ('NORMAL_DCA', 'LIGHT_DIP', 'MODERATE_DIP', 'DIP_BUCKET', 'CRASH_BUCKET');

-- CreateEnum
CREATE TYPE "BucketType" AS ENUM ('CORE', 'DIP', 'CRASH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalCapital" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "companyName" TEXT,
    "targetPercentage" DECIMAL(5,2) NOT NULL,
    "allocationUSD" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "coreBucketUSD" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "dipBucketUSD" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "crashBucketUSD" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "coreUsedUSD" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "dipUsedUSD" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "crashUsedUSD" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sharesOwned" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "avgCostBasis" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prices_daily" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "open" DECIMAL(18,4),
    "high" DECIMAL(18,4),
    "low" DECIMAL(18,4),
    "close" DECIMAL(18,4) NOT NULL,
    "volume" BIGINT,
    "fiftyTwoWeekHigh" DECIMAL(18,4),
    "fiftyTwoWeekLow" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prices_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "fees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "date" DATE NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_budgets" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "plannedAmount" DECIMAL(18,2) NOT NULL,
    "usedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(18,2) NOT NULL,
    "carryForward" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_snapshots" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "totalBudget" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategy_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buy_plans" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "currentPrice" DECIMAL(18,4) NOT NULL,
    "fiftyTwoWeekHigh" DECIMAL(18,4) NOT NULL,
    "dipPercentage" DECIMAL(5,2) NOT NULL,
    "dipLevelTriggered" "DipLevel" NOT NULL,
    "suggestedPrice" DECIMAL(18,4) NOT NULL,
    "suggestedQuantity" DECIMAL(18,6) NOT NULL,
    "capitalRequired" DECIMAL(18,2) NOT NULL,
    "bucketUsed" "BucketType" NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isExecuted" BOOLEAN NOT NULL DEFAULT false,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buy_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "portfolios_userId_idx" ON "portfolios"("userId");

-- CreateIndex
CREATE INDEX "allocations_portfolioId_idx" ON "allocations"("portfolioId");

-- CreateIndex
CREATE INDEX "allocations_symbol_idx" ON "allocations"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "allocations_portfolioId_symbol_key" ON "allocations"("portfolioId", "symbol");

-- CreateIndex
CREATE INDEX "prices_daily_symbol_date_idx" ON "prices_daily"("symbol", "date");

-- CreateIndex
CREATE INDEX "prices_daily_symbol_idx" ON "prices_daily"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "prices_daily_symbol_date_key" ON "prices_daily"("symbol", "date");

-- CreateIndex
CREATE INDEX "transactions_portfolioId_idx" ON "transactions"("portfolioId");

-- CreateIndex
CREATE INDEX "transactions_symbol_idx" ON "transactions"("symbol");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "transactions_portfolioId_symbol_idx" ON "transactions"("portfolioId", "symbol");

-- CreateIndex
CREATE INDEX "weekly_budgets_portfolioId_idx" ON "weekly_budgets"("portfolioId");

-- CreateIndex
CREATE INDEX "weekly_budgets_weekStartDate_idx" ON "weekly_budgets"("weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_budgets_portfolioId_weekStartDate_key" ON "weekly_budgets"("portfolioId", "weekStartDate");

-- CreateIndex
CREATE INDEX "strategy_snapshots_portfolioId_idx" ON "strategy_snapshots"("portfolioId");

-- CreateIndex
CREATE INDEX "strategy_snapshots_asOfDate_idx" ON "strategy_snapshots"("asOfDate");

-- CreateIndex
CREATE INDEX "buy_plans_snapshotId_idx" ON "buy_plans"("snapshotId");

-- CreateIndex
CREATE INDEX "buy_plans_symbol_idx" ON "buy_plans"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "global_config_key_key" ON "global_config"("key");

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_budgets" ADD CONSTRAINT "weekly_budgets_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_snapshots" ADD CONSTRAINT "strategy_snapshots_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buy_plans" ADD CONSTRAINT "buy_plans_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "strategy_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
