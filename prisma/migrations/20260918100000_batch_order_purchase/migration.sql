-- CreateEnum
CREATE TYPE "BatchOrderStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "originalPrice" DOUBLE PRECISION,
ADD COLUMN     "price" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "batch_orders" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "BatchOrderStatus" NOT NULL DEFAULT 'PENDING',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "batch_orders_razorpayOrderId_key" ON "batch_orders"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "batch_orders_studentId_idx" ON "batch_orders"("studentId");

-- CreateIndex
CREATE INDEX "batch_orders_batchId_idx" ON "batch_orders"("batchId");

-- CreateIndex
CREATE INDEX "batch_orders_status_idx" ON "batch_orders"("status");

-- AddForeignKey
ALTER TABLE "batch_orders" ADD CONSTRAINT "batch_orders_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_orders" ADD CONSTRAINT "batch_orders_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
