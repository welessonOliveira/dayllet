-- CreateTable
CREATE TABLE "IndexRate" (
    "series" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndexRate_pkey" PRIMARY KEY ("series","month")
);

