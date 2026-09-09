-- Unified account lifecycle: nullable role (a user can have NO role) and
-- extra UserStatus states. Fully backward-compatible — every existing row
-- keeps its roleId and its current status.

-- 1. Allow User.roleId to be NULL
ALTER TABLE "users" ALTER COLUMN "roleId" DROP NOT NULL;

-- The FK was ON DELETE ... ; keep it, NULL is simply allowed now.

-- 2. New UserStatus values (Postgres: ADD VALUE is idempotent-guarded)
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'APPROVAL_PENDING';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'INVITED';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'NO_ROLE';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'EX_EDUCATOR';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'EX_TEAM_MEMBER';
