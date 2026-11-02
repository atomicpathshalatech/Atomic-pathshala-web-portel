-- ID cards: one row per person per kind (STUDENT / TEAM) with the random QR
-- verification token, card status and public-photo consent. New table only;
-- no existing table or row is touched.
-- Rollback: DROP TABLE "id_cards"; DROP TYPE "IdCardKind"; DROP TYPE "IdCardStatus";

DO $$ BEGIN
  CREATE TYPE "IdCardKind" AS ENUM ('STUDENT', 'TEAM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "IdCardStatus" AS ENUM ('ACTIVE', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "id_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "IdCardKind" NOT NULL,
    "publicToken" TEXT NOT NULL,
    "status" "IdCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "showPhotoPublicly" BOOLEAN NOT NULL DEFAULT false,
    "employeeCode" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reissuedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "lastDownloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "id_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "id_cards_publicToken_key" ON "id_cards"("publicToken");
CREATE UNIQUE INDEX IF NOT EXISTS "id_cards_employeeCode_key" ON "id_cards"("employeeCode");
CREATE UNIQUE INDEX IF NOT EXISTS "id_cards_userId_kind_key" ON "id_cards"("userId", "kind");
CREATE INDEX IF NOT EXISTS "id_cards_kind_status_idx" ON "id_cards"("kind", "status");

DO $$ BEGIN
  ALTER TABLE "id_cards" ADD CONSTRAINT "id_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
