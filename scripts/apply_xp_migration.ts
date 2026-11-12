import { prisma } from "../src/lib/db";

async function executeSingle(sql: string) {
  const trimmed = sql.trim();
  if (!trimmed) return;
  try {
    await prisma.$executeRawUnsafe(trimmed);
  } catch (err: any) {
    console.error(`Error executing: ${trimmed.slice(0, 50)}...`, err?.message || err);
    throw err;
  }
}

async function runMigration() {
  console.log("Starting XP Gamification Schema Migration (individual commands)...");

  // Enums
  await executeSingle(`
    DO $$ BEGIN
      ALTER TYPE "XPReason" ADD VALUE IF NOT EXISTS 'MANUAL_ADJUSTMENT';
      ALTER TYPE "XPReason" ADD VALUE IF NOT EXISTS 'REWARD_REDEMPTION';
      ALTER TYPE "XPReason" ADD VALUE IF NOT EXISTS 'RANK_MILESTONE';
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  await executeSingle(`
    DO $$ BEGIN
      CREATE TYPE "XPTransactionStatus" AS ENUM ('SUCCESSFUL', 'PENDING', 'FAILED', 'REVERSED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await executeSingle(`
    DO $$ BEGIN
      CREATE TYPE "XPRewardCategory" AS ENUM (
        'DAILY_LOGIN', 'LIVE_CLASS_ATTENDANCE', 'RECORDED_LECTURE', 'LIVE_CLASS_PARTICIPATION',
        'DPP_COMPLETION', 'QUESTION_PRACTICE', 'CORRECT_ANSWER', 'TEST_SUBMISSION',
        'TEST_PERFORMANCE', 'DAILY_STUDY_STREAK', 'WEEKLY_STUDY_STREAK', 'DOUBT_PARTICIPATION',
        'ASSIGNMENT_COMPLETION', 'ACHIEVEMENT_UNLOCK', 'RANK_MILESTONE', 'MANUAL_ADJUSTMENT',
        'REWARD_REDEMPTION', 'OTHER'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await executeSingle(`
    DO $$ BEGIN
      CREATE TYPE "XPFrequencyLimit" AS ENUM ('UNLIMITED', 'ONCE_PER_DAY', 'ONCE_PER_WEEK', 'ONCE_PER_EVENT', 'ONCE_LIFETIME');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // Table: xp_reward_rules
  await executeSingle(`
    CREATE TABLE IF NOT EXISTS "xp_reward_rules" (
      "id" TEXT NOT NULL,
      "activityName" TEXT NOT NULL,
      "displayLabel" TEXT NOT NULL,
      "description" TEXT,
      "category" "XPRewardCategory" NOT NULL,
      "xpPoints" INTEGER NOT NULL,
      "triggerEvent" TEXT NOT NULL,
      "eligibilityConditions" JSONB,
      "frequencyLimit" "XPFrequencyLimit" NOT NULL DEFAULT 'UNLIMITED',
      "dailyLimit" INTEGER,
      "weeklyLimit" INTEGER,
      "maxRewardsLifetime" INTEGER,
      "effectiveStartDate" TIMESTAMP(3),
      "effectiveEndDate" TIMESTAMP(3),
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "version" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "xp_reward_rules_pkey" PRIMARY KEY ("id")
    );
  `);
  await executeSingle(`CREATE UNIQUE INDEX IF NOT EXISTS "xp_reward_rules_activityName_key" ON "xp_reward_rules"("activityName");`);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_reward_rules_category_idx" ON "xp_reward_rules"("category");`);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_reward_rules_isActive_idx" ON "xp_reward_rules"("isActive");`);

  // Table: xp_rule_versions
  await executeSingle(`
    CREATE TABLE IF NOT EXISTS "xp_rule_versions" (
      "id" TEXT NOT NULL,
      "ruleId" TEXT NOT NULL,
      "version" INTEGER NOT NULL,
      "displayLabel" TEXT NOT NULL,
      "xpPoints" INTEGER NOT NULL,
      "category" "XPRewardCategory" NOT NULL,
      "eligibilityConditions" JSONB,
      "frequencyLimit" "XPFrequencyLimit" NOT NULL,
      "dailyLimit" INTEGER,
      "weeklyLimit" INTEGER,
      "maxRewardsLifetime" INTEGER,
      "isActive" BOOLEAN NOT NULL,
      "changeReason" TEXT,
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "xp_rule_versions_pkey" PRIMARY KEY ("id")
    );
  `);
  await executeSingle(`CREATE UNIQUE INDEX IF NOT EXISTS "xp_rule_versions_ruleId_version_key" ON "xp_rule_versions"("ruleId", "version");`);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_rule_versions_ruleId_idx" ON "xp_rule_versions"("ruleId");`);

  // Table: xp_transactions
  await executeSingle(`
    CREATE TABLE IF NOT EXISTS "xp_transactions" (
      "id" TEXT NOT NULL,
      "studentId" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "reason" "XPReason" NOT NULL DEFAULT 'OTHER',
      "status" "XPTransactionStatus" NOT NULL DEFAULT 'SUCCESSFUL',
      "activity" TEXT NOT NULL,
      "rewardLabel" TEXT NOT NULL,
      "idempotencyKey" TEXT,
      "ruleId" TEXT,
      "ruleVersion" INTEGER,
      "failureReason" TEXT,
      "balanceBefore" INTEGER NOT NULL DEFAULT 0,
      "balanceAfter" INTEGER NOT NULL DEFAULT 0,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "xp_transactions_pkey" PRIMARY KEY ("id")
    );
  `);
  await executeSingle(`CREATE UNIQUE INDEX IF NOT EXISTS "xp_transactions_idempotencyKey_key" ON "xp_transactions"("idempotencyKey");`);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_transactions_studentId_createdAt_idx" ON "xp_transactions"("studentId", "createdAt");`);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_transactions_createdAt_idx" ON "xp_transactions"("createdAt");`);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_transactions_status_idx" ON "xp_transactions"("status");`);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_transactions_ruleId_idx" ON "xp_transactions"("ruleId");`);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_transactions_activity_idx" ON "xp_transactions"("activity");`);

  // Table: xp_adjustments
  await executeSingle(`
    CREATE TABLE IF NOT EXISTS "xp_adjustments" (
      "id" TEXT NOT NULL,
      "transactionId" TEXT NOT NULL,
      "studentId" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "reason" TEXT NOT NULL,
      "previousBalance" INTEGER NOT NULL,
      "updatedBalance" INTEGER NOT NULL,
      "adminId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "xp_adjustments_pkey" PRIMARY KEY ("id")
    );
  `);
  await executeSingle(`CREATE UNIQUE INDEX IF NOT EXISTS "xp_adjustments_transactionId_key" ON "xp_adjustments"("transactionId");`);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_adjustments_studentId_idx" ON "xp_adjustments"("studentId");`);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_adjustments_adminId_idx" ON "xp_adjustments"("adminId");`);

  // Table: xp_activity_events
  await executeSingle(`
    CREATE TABLE IF NOT EXISTS "xp_activity_events" (
      "id" TEXT NOT NULL,
      "studentId" TEXT NOT NULL,
      "activityType" TEXT NOT NULL,
      "sourceEntityId" TEXT,
      "idempotencyKey" TEXT NOT NULL,
      "payload" JSONB,
      "processed" BOOLEAN NOT NULL DEFAULT false,
      "transactionId" TEXT,
      "error" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "xp_activity_events_pkey" PRIMARY KEY ("id")
    );
  `);
  await executeSingle(`CREATE UNIQUE INDEX IF NOT EXISTS "xp_activity_events_idempotencyKey_key" ON "xp_activity_events"("idempotencyKey");`);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_activity_events_studentId_activityType_idx" ON "xp_activity_events"("studentId", "activityType");`);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_activity_events_createdAt_idx" ON "xp_activity_events"("createdAt");`);

  // Table: xp_audit_logs
  await executeSingle(`
    CREATE TABLE IF NOT EXISTS "xp_audit_logs" (
      "id" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "adminId" TEXT NOT NULL,
      "details" JSONB,
      "ipAddress" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "xp_audit_logs_pkey" PRIMARY KEY ("id")
    );
  `);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_audit_logs_adminId_idx" ON "xp_audit_logs"("adminId");`);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_audit_logs_action_idx" ON "xp_audit_logs"("action");`);
  await executeSingle(`CREATE INDEX IF NOT EXISTS "xp_audit_logs_createdAt_idx" ON "xp_audit_logs"("createdAt");`);

  // Foreign keys
  const fks = [
    `DO $$ BEGIN ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "xp_reward_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE "xp_rule_versions" ADD CONSTRAINT "xp_rule_versions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "xp_reward_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE "xp_rule_versions" ADD CONSTRAINT "xp_rule_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE "xp_adjustments" ADD CONSTRAINT "xp_adjustments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE "xp_adjustments" ADD CONSTRAINT "xp_adjustments_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE "xp_adjustments" ADD CONSTRAINT "xp_adjustments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "xp_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE "xp_activity_events" ADD CONSTRAINT "xp_activity_events_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE "xp_audit_logs" ADD CONSTRAINT "xp_audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  ];
  for (const fk of fks) {
    await executeSingle(fk);
  }

  // Migrate existing xp_events
  const txCount = await prisma.xPTransaction.count();
  console.log(`Current XP transactions count: ${txCount}`);
  if (txCount === 0) {
    console.log("Migrating existing xp_events to xp_transactions...");
    await executeSingle(`
      INSERT INTO "xp_transactions" (
        "id", "studentId", "amount", "reason", "status", "activity", "rewardLabel",
        "idempotencyKey", "balanceBefore", "balanceAfter", "metadata", "createdAt", "updatedAt"
      )
      SELECT
        e."id",
        e."studentId",
        e."amount",
        e."reason",
        'SUCCESSFUL'::"XPTransactionStatus",
        e."reason"::text,
        REPLACE(INITCAP(REPLACE(e."reason"::text, '_', ' ')), 'Xp', 'XP'),
        'legacy_' || e."id",
        0,
        e."amount",
        e."metadata",
        e."createdAt",
        e."createdAt"
      FROM "xp_events" e
      ON CONFLICT ("id") DO NOTHING;
    `);
    const newTxCount = await prisma.xPTransaction.count();
    console.log(`Migrated ${newTxCount} rows from xp_events into xp_transactions.`);
  }

  // Seed default rules
  const rules = [
    {
      activityName: "DAILY_LOGIN",
      displayLabel: "Daily App Login",
      description: "Daily active attendance / login in the Atomic Pathshala app",
      category: "DAILY_LOGIN",
      xpPoints: 10,
      triggerEvent: "USER_LOGIN",
      frequencyLimit: "ONCE_PER_DAY",
      dailyLimit: 10,
      isActive: true,
    },
    {
      activityName: "LIVE_CLASS_ATTENDANCE",
      displayLabel: "Live Class Attendance",
      description: "Attending a live classroom session",
      category: "LIVE_CLASS_ATTENDANCE",
      xpPoints: 20,
      triggerEvent: "CLASS_JOIN",
      frequencyLimit: "ONCE_PER_EVENT",
      isActive: true,
    },
    {
      activityName: "RECORDED_LECTURE",
      displayLabel: "Recorded Lecture Completed",
      description: "Completing a recorded video lecture",
      category: "RECORDED_LECTURE",
      xpPoints: 15,
      triggerEvent: "LECTURE_COMPLETED",
      frequencyLimit: "ONCE_PER_EVENT",
      isActive: true,
    },
    {
      activityName: "LIVE_CLASS_PARTICIPATION",
      displayLabel: "Live Class Active Participation",
      description: "Asking questions or participating in live chat/whiteboard",
      category: "LIVE_CLASS_PARTICIPATION",
      xpPoints: 5,
      triggerEvent: "CLASS_PARTICIPATION",
      frequencyLimit: "ONCE_PER_DAY",
      dailyLimit: 20,
      isActive: true,
    },
    {
      activityName: "DPP_COMPLETION",
      displayLabel: "Daily Practice Paper (DPP)",
      description: "Submitting and completing a Daily Practice Paper",
      category: "DPP_COMPLETION",
      xpPoints: 25,
      triggerEvent: "DPP_SUBMIT",
      frequencyLimit: "ONCE_PER_EVENT",
      isActive: true,
    },
    {
      activityName: "QUESTION_PRACTICE",
      displayLabel: "Practice Question Completed",
      description: "Practicing questions in practice sets or NCERT modules",
      category: "QUESTION_PRACTICE",
      xpPoints: 5,
      triggerEvent: "QUESTION_ANSWERED",
      frequencyLimit: "UNLIMITED",
      dailyLimit: 50,
      isActive: true,
    },
    {
      activityName: "CORRECT_ANSWER",
      displayLabel: "Correct Answer Bonus",
      description: "Bonus reward for correct answers during quiz / practice",
      category: "CORRECT_ANSWER",
      xpPoints: 4,
      triggerEvent: "CORRECT_ANSWER_SUBMITTED",
      frequencyLimit: "UNLIMITED",
      dailyLimit: 100,
      isActive: true,
    },
    {
      activityName: "TEST_SUBMISSION",
      displayLabel: "Full Mock / Chapter Test Submission",
      description: "Submitting a completed scheduled test or mock examination",
      category: "TEST_SUBMISSION",
      xpPoints: 50,
      triggerEvent: "TEST_SUBMIT",
      frequencyLimit: "ONCE_PER_EVENT",
      isActive: true,
    },
    {
      activityName: "TEST_PERFORMANCE",
      displayLabel: "High Score Test Performance",
      description: "High score excellence (80%+ score on test)",
      category: "TEST_PERFORMANCE",
      xpPoints: 100,
      triggerEvent: "TEST_HIGH_SCORE",
      eligibilityConditions: { minScorePercent: 80 },
      frequencyLimit: "ONCE_PER_EVENT",
      isActive: true,
    },
    {
      activityName: "DAILY_STUDY_STREAK",
      displayLabel: "Daily Study Streak Bonus",
      description: "Maintaining continuous daily study streak",
      category: "DAILY_STUDY_STREAK",
      xpPoints: 15,
      triggerEvent: "STREAK_MAINTAINED",
      frequencyLimit: "ONCE_PER_DAY",
      dailyLimit: 15,
      isActive: true,
    },
    {
      activityName: "WEEKLY_STUDY_STREAK",
      displayLabel: "7-Day Consistent Study Streak",
      description: "Reaching a 7-day continuous study streak milestone",
      category: "WEEKLY_STUDY_STREAK",
      xpPoints: 50,
      triggerEvent: "STREAK_7_DAYS",
      frequencyLimit: "ONCE_PER_WEEK",
      isActive: true,
    },
    {
      activityName: "DOUBT_PARTICIPATION",
      displayLabel: "Academic Doubt Resolved",
      description: "Submitting and successfully resolving an academic doubt",
      category: "DOUBT_PARTICIPATION",
      xpPoints: 15,
      triggerEvent: "DOUBT_RESOLVED",
      frequencyLimit: "ONCE_PER_EVENT",
      isActive: true,
    },
    {
      activityName: "ASSIGNMENT_COMPLETION",
      displayLabel: "Assignment Completed",
      description: "Submitting course assignment or homework sheet",
      category: "ASSIGNMENT_COMPLETION",
      xpPoints: 30,
      triggerEvent: "ASSIGNMENT_SUBMIT",
      frequencyLimit: "ONCE_PER_EVENT",
      isActive: true,
    },
    {
      activityName: "ACHIEVEMENT_UNLOCK",
      displayLabel: "Achievement Badge Unlocked",
      description: "Earning a milestone achievement badge",
      category: "ACHIEVEMENT_UNLOCK",
      xpPoints: 50,
      triggerEvent: "BADGE_UNLOCKED",
      frequencyLimit: "ONCE_PER_EVENT",
      isActive: true,
    },
    {
      activityName: "RANK_MILESTONE_TOP100",
      displayLabel: "First Entry into Top 100",
      description: "Milestone reward for first time ranking in Top 100",
      category: "RANK_MILESTONE",
      xpPoints: 100,
      triggerEvent: "RANK_TOP_100",
      eligibilityConditions: { maxRank: 100 },
      frequencyLimit: "ONCE_LIFETIME",
      isActive: true,
    },
    {
      activityName: "RANK_MILESTONE_TOP50",
      displayLabel: "First Entry into Top 50",
      description: "Milestone reward for first time ranking in Top 50",
      category: "RANK_MILESTONE",
      xpPoints: 200,
      triggerEvent: "RANK_TOP_50",
      eligibilityConditions: { maxRank: 50 },
      frequencyLimit: "ONCE_LIFETIME",
      isActive: true,
    },
    {
      activityName: "RANK_MILESTONE_TOP10",
      displayLabel: "First Entry into Top 10",
      description: "Milestone reward for first time ranking in Top 10",
      category: "RANK_MILESTONE",
      xpPoints: 500,
      triggerEvent: "RANK_TOP_10",
      eligibilityConditions: { maxRank: 10 },
      frequencyLimit: "ONCE_LIFETIME",
      isActive: true,
    },
    {
      activityName: "RANK_MILESTONE_RANK1",
      displayLabel: "Rank 1 Champion",
      description: "Milestone reward for achieving Rank 1 on leaderboard",
      category: "RANK_MILESTONE",
      xpPoints: 1000,
      triggerEvent: "RANK_1",
      eligibilityConditions: { maxRank: 1 },
      frequencyLimit: "ONCE_LIFETIME",
      isActive: true,
    },
  ];

  for (const r of rules) {
    const existing = await prisma.xPRewardRule.findUnique({ where: { activityName: r.activityName } });
    if (!existing) {
      const created = await prisma.xPRewardRule.create({
        data: {
          activityName: r.activityName,
          displayLabel: r.displayLabel,
          description: r.description,
          category: r.category as any,
          xpPoints: r.xpPoints,
          triggerEvent: r.triggerEvent,
          eligibilityConditions: r.eligibilityConditions || undefined,
          frequencyLimit: r.frequencyLimit as any,
          dailyLimit: r.dailyLimit,
          isActive: r.isActive,
          version: 1,
        },
      });

      await prisma.xPRuleVersion.create({
        data: {
          ruleId: created.id,
          version: 1,
          displayLabel: created.displayLabel,
          xpPoints: created.xpPoints,
          category: created.category,
          eligibilityConditions: created.eligibilityConditions || undefined,
          frequencyLimit: created.frequencyLimit,
          dailyLimit: created.dailyLimit,
          isActive: created.isActive,
          changeReason: "Initial system seeding",
        },
      });
      console.log(`Seeded reward rule: ${r.activityName} (${r.xpPoints} XP)`);
    }
  }

  console.log("Migration and seeding complete successfully!");
}

runMigration()
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
