-- CreateEnum
CREATE TYPE "BroadcastSegmentType" AS ENUM ('ALL', 'BATCH', 'CLASS', 'TARGET_EXAM');

-- CreateTable
CREATE TABLE "notification_broadcasts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "segmentType" "BroadcastSegmentType" NOT NULL,
    "segmentValue" TEXT,
    "recipientCount" INTEGER NOT NULL,
    "sentById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_broadcasts_createdAt_idx" ON "notification_broadcasts"("createdAt");

-- AddForeignKey
ALTER TABLE "notification_broadcasts" ADD CONSTRAINT "notification_broadcasts_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
