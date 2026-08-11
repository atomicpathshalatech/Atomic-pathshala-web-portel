-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING_DOCUMENTS', 'PENDING_REVIEW', 'PENDING_CONTRACT', 'ACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('GOVT_ID_FRONT', 'GOVT_ID_BACK', 'PAN_CARD', 'ADDRESS_PROOF', 'EDUCATION_CERTIFICATE', 'PHOTO');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'DECLINED');

-- CreateEnum
CREATE TYPE "PenaltyDeductionType" AS ENUM ('FIXED_AMOUNT', 'PERCENT_OF_PAYOUT');

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'PENDING_DOCUMENTS',
ADD COLUMN     "rating" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "teacher_documents" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "status" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionNote" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedName" TEXT,
    "signatureIp" TEXT,
    "declinedReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "deductionType" "PenaltyDeductionType" NOT NULL DEFAULT 'FIXED_AMOUNT',
    "deductionValue" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penalty_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_records" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "month" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalty_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_documents_teacherId_idx" ON "teacher_documents"("teacherId");

-- CreateIndex
CREATE INDEX "teacher_documents_status_idx" ON "teacher_documents"("status");

-- CreateIndex
CREATE INDEX "contracts_teacherId_idx" ON "contracts"("teacherId");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "penalty_records_teacherId_idx" ON "penalty_records"("teacherId");

-- CreateIndex
CREATE INDEX "penalty_records_month_idx" ON "penalty_records"("month");

-- CreateIndex
CREATE INDEX "teachers_onboardingStatus_idx" ON "teachers"("onboardingStatus");

-- AddForeignKey
ALTER TABLE "teacher_documents" ADD CONSTRAINT "teacher_documents_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_records" ADD CONSTRAINT "penalty_records_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_records" ADD CONSTRAINT "penalty_records_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "penalty_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
