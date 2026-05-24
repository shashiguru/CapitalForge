-- CreateTable
CREATE TABLE "budget_preset_stocks" (
    "id" TEXT NOT NULL,
    "budgetPresetId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "companyName" TEXT,
    "targetPercentage" DECIMAL(5,2) NOT NULL,
    "isAggressive" BOOLEAN NOT NULL DEFAULT false,
    "fiftyTwoWeekHigh" DECIMAL(18,4),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_preset_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budget_preset_stocks_budgetPresetId_symbol_key" ON "budget_preset_stocks"("budgetPresetId", "symbol");

-- CreateIndex
CREATE INDEX "budget_preset_stocks_budgetPresetId_idx" ON "budget_preset_stocks"("budgetPresetId");

-- AddForeignKey
ALTER TABLE "budget_preset_stocks" ADD CONSTRAINT "budget_preset_stocks_budgetPresetId_fkey" FOREIGN KEY ("budgetPresetId") REFERENCES "budget_presets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed each preset with a copy of the portfolio's current allocations
INSERT INTO "budget_preset_stocks" (
    "id",
    "budgetPresetId",
    "symbol",
    "companyName",
    "targetPercentage",
    "isAggressive",
    "fiftyTwoWeekHigh",
    "sortOrder",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    bp."id",
    a."symbol",
    a."companyName",
    a."targetPercentage",
    a."isAggressive",
    a."fiftyTwoWeekHigh",
    ROW_NUMBER() OVER (PARTITION BY bp."id" ORDER BY a."symbol") - 1,
    CURRENT_TIMESTAMP
FROM "budget_presets" bp
JOIN "allocations" a ON a."portfolioId" = bp."portfolioId" AND a."isActive" = true;
