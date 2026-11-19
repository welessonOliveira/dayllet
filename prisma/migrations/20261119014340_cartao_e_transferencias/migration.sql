-- AlterEnum
ALTER TYPE "WalletKind" ADD VALUE 'CREDIT_CARD';

-- AlterTable
ALTER TABLE "ImportRow" ADD COLUMN     "looksLikeTransfer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transferWalletId" TEXT;

-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN     "importBatchId" TEXT;

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "closingDay" INTEGER,
ADD COLUMN     "dueDay" INTEGER;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

