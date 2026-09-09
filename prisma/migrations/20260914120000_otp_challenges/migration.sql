-- Phone-OTP challenges for the simplified student sign-up + OTP password reset.

DO $$ BEGIN
  CREATE TYPE "OtpPurpose" AS ENUM ('STUDENT_SIGNUP', 'PASSWORD_RESET');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "otp_challenges" (
  "id"                   TEXT NOT NULL,
  "phone"                TEXT NOT NULL,
  "purpose"              "OtpPurpose" NOT NULL,
  "codeHash"             TEXT NOT NULL,
  "ipHash"               TEXT,
  "attempts"             INTEGER NOT NULL DEFAULT 0,
  "maxAttempts"          INTEGER NOT NULL DEFAULT 5,
  "consumedAt"           TIMESTAMP(3),
  "verifyToken"          TEXT,
  "verifyTokenExpiresAt" TIMESTAMP(3),
  "expiresAt"            TIMESTAMP(3) NOT NULL,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "otp_challenges_verifyToken_key" ON "otp_challenges" ("verifyToken");
CREATE INDEX IF NOT EXISTS "otp_challenges_phone_purpose_createdAt_idx" ON "otp_challenges" ("phone", "purpose", "createdAt");
CREATE INDEX IF NOT EXISTS "otp_challenges_ipHash_createdAt_idx" ON "otp_challenges" ("ipHash", "createdAt");
