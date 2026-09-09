-- Admin-initiated staff/educator invitations.

DO $$ BEGIN
  CREATE TYPE "StaffInvitationStatus" AS ENUM (
    'PENDING', 'OPENED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "staff_invitations" (
  "id"               TEXT NOT NULL,
  "email"            TEXT NOT NULL,
  "phone"            TEXT NOT NULL,
  "tokenHash"        TEXT NOT NULL,
  "intendedRoleName" TEXT,
  "status"           "StaffInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "invitedById"      TEXT NOT NULL,
  "createdUserId"    TEXT,
  "openedAt"         TIMESTAMP(3),
  "submittedAt"      TIMESTAMP(3),
  "reviewedById"     TEXT,
  "reviewedAt"       TIMESTAMP(3),
  "reviewNote"       TEXT,
  "expiresAt"        TIMESTAMP(3) NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_invitations_tokenHash_key" ON "staff_invitations" ("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "staff_invitations_createdUserId_key" ON "staff_invitations" ("createdUserId");
CREATE INDEX IF NOT EXISTS "staff_invitations_email_idx" ON "staff_invitations" ("email");
CREATE INDEX IF NOT EXISTS "staff_invitations_status_idx" ON "staff_invitations" ("status");

DO $$ BEGIN
  ALTER TABLE "staff_invitations"
    ADD CONSTRAINT "staff_invitations_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "staff_invitations"
    ADD CONSTRAINT "staff_invitations_createdUserId_fkey"
    FOREIGN KEY ("createdUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
