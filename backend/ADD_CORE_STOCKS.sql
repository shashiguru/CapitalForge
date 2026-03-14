-- Run this in Supabase SQL Editor if you have an existing database without core_stocks table
CREATE TABLE IF NOT EXISTS "core_stocks" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "core_stocks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "core_stocks_portfolioId_symbol_key" ON "core_stocks"("portfolioId", "symbol");
CREATE INDEX IF NOT EXISTS "core_stocks_portfolioId_idx" ON "core_stocks"("portfolioId");
ALTER TABLE "core_stocks" DROP CONSTRAINT IF EXISTS "core_stocks_portfolioId_fkey";
ALTER TABLE "core_stocks" ADD CONSTRAINT "core_stocks_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
