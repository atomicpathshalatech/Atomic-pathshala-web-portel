import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Applying non-destructive CRM tables migration...");

  const queries = [
    // 1. Enums
    `DO $$ BEGIN
      CREATE TYPE "CRMLeadStatus" AS ENUM (
        'NEW_LEAD', 'UNASSIGNED', 'ASSIGNED', 'FIRST_CALL_PENDING', 'CONTACTED',
        'NOT_CONNECTED', 'INTERESTED', 'HIGHLY_INTERESTED', 'COUNSELLING_SCHEDULED',
        'COUNSELLING_COMPLETED', 'DEMO_SCHEDULED', 'DEMO_ATTENDED', 'FOLLOW_UP_REQUIRED',
        'PAYMENT_PENDING', 'ADMISSION_CONFIRMED', 'ENROLLED', 'NOT_INTERESTED', 'LOST',
        'INVALID_NUMBER', 'DUPLICATE'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "CRMLeadPriority" AS ENUM ('HOT', 'WARM', 'COLD');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "CRMLeadSource" AS ENUM (
        'WEBSITE', 'REGISTRATION_FORM', 'COURSE_LANDING_PAGE', 'META_ADS', 'GOOGLE_ADS',
        'YOUTUBE', 'INSTAGRAM', 'WHATSAPP', 'ORGANIC_SEARCH', 'REFERRAL', 'TELEGRAM',
        'OFFLINE_COUNSELLING', 'MANUAL_ENTRY', 'CSV_IMPORT', 'GOOGLE_FORMS', 'API_WEBHOOK', 'OTHER'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "CRMActivityType" AS ENUM (
        'STATUS_CHANGE', 'STAGE_CHANGE', 'NOTE_ADDED', 'CALL_LOGGED', 'COUNSELLING_SCHEDULED',
        'COUNSELLING_COMPLETED', 'DEMO_SCHEDULED', 'DEMO_ATTENDED', 'FOLLOW_UP_CREATED',
        'FOLLOW_UP_COMPLETED', 'WHATSAPP_SENT', 'WHATSAPP_RECEIVED', 'EMAIL_SENT', 'SMS_SENT',
        'PAYMENT_LINK_SENT', 'PAYMENT_RECEIVED', 'ADMISSION_CREATED', 'STUDENT_ENROLLED',
        'ASSIGNMENT_CHANGED', 'SCORE_UPDATED', 'MERGED_DUPLICATE'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "CRMFollowUpType" AS ENUM (
        'PHONE_CALL', 'WHATSAPP', 'SMS', 'EMAIL', 'COUNSELLING', 'DEMO_CLASS', 'PAYMENT_REMINDER'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "CRMFollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'OVERDUE', 'CANCELLED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "CRMCallOutcome" AS ENUM (
        'CONNECTED', 'NOT_ANSWERED', 'BUSY', 'SWITCHED_OFF', 'INVALID_NUMBER',
        'INTERESTED', 'NOT_INTERESTED', 'CALL_BACK_LATER', 'ADMISSION_CONFIRMED'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "CRMCounsellingOutcome" AS ENUM (
        'HIGH_INTEREST', 'MODERATE_INTEREST', 'NEED_PARENT_DISCUSSION', 'DEMO_RECOMMENDED',
        'ADMISSION_OFFERED', 'FEES_OBJECTION', 'NOT_INTERESTED'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "CRMCampaignPlatform" AS ENUM (
        'META', 'GOOGLE', 'YOUTUBE', 'INSTAGRAM', 'WHATSAPP', 'ORGANIC', 'REFERRAL', 'ADMISSION_DRIVE', 'OFFLINE'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "CRMCampaignStatus" AS ENUM ('PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    // 2. Campaigns table
    `CREATE TABLE IF NOT EXISTS "crm_campaigns" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "campaignCode" TEXT NOT NULL UNIQUE,
      "platform" "CRMCampaignPlatform" NOT NULL DEFAULT 'META',
      "status" "CRMCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
      "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "startDate" TIMESTAMP(3),
      "endDate" TIMESTAMP(3),
      "targetAudience" TEXT,
      "targetCourseId" TEXT,
      "utmSource" TEXT,
      "utmCampaign" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS "crm_campaigns_platform_idx" ON "crm_campaigns"("platform");`,
    `CREATE INDEX IF NOT EXISTS "crm_campaigns_status_idx" ON "crm_campaigns"("status");`,

    // 3. Leads table
    `CREATE TABLE IF NOT EXISTS "crm_leads" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "leadCode" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "phone" TEXT NOT NULL,
      "cleanPhone" TEXT NOT NULL,
      "alternatePhone" TEXT,
      "whatsappNumber" TEXT,
      "email" TEXT,
      "fatherName" TEXT,
      "motherName" TEXT,
      "studentClass" TEXT,
      "board" TEXT,
      "medium" TEXT,
      "targetExam" TEXT,
      "targetYear" INTEGER,
      "preferredSubject" TEXT,
      "preferredCourse" TEXT,
      "targetCourseId" TEXT REFERENCES "courses"("id") ON DELETE SET NULL,
      "targetBatchId" TEXT REFERENCES "batches"("id") ON DELETE SET NULL,
      "state" TEXT,
      "city" TEXT,
      "school" TEXT,
      "academicBackground" TEXT,
      "previousScore" TEXT,
      "expectedBudget" DOUBLE PRECISION,
      "status" "CRMLeadStatus" NOT NULL DEFAULT 'NEW_LEAD',
      "priority" "CRMLeadPriority" NOT NULL DEFAULT 'WARM',
      "score" INTEGER NOT NULL DEFAULT 0,
      "source" "CRMLeadSource" NOT NULL DEFAULT 'WEBSITE',
      "campaignId" TEXT REFERENCES "crm_campaigns"("id") ON DELETE SET NULL,
      "campaignName" TEXT,
      "utmSource" TEXT,
      "utmMedium" TEXT,
      "utmCampaign" TEXT,
      "utmContent" TEXT,
      "utmTerm" TEXT,
      "landingPage" TEXT,
      "referrerUrl" TEXT,
      "firstTouchSource" TEXT,
      "lastTouchSource" TEXT,
      "assignedUserId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
      "lastContactedAt" TIMESTAMP(3),
      "nextFollowUpAt" TIMESTAMP(3),
      "isConverted" BOOLEAN NOT NULL DEFAULT false,
      "studentId" TEXT REFERENCES "students"("id") ON DELETE SET NULL,
      "notes" TEXT,
      "customFields" JSONB,
      "tags" TEXT[] NOT NULL DEFAULT '{}',
      "deletedAt" TIMESTAMP(3),
      "duplicateOfId" TEXT REFERENCES "crm_leads"("id") ON DELETE SET NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS "crm_leads_cleanPhone_idx" ON "crm_leads"("cleanPhone");`,
    `CREATE INDEX IF NOT EXISTS "crm_leads_email_idx" ON "crm_leads"("email");`,
    `CREATE INDEX IF NOT EXISTS "crm_leads_status_idx" ON "crm_leads"("status");`,
    `CREATE INDEX IF NOT EXISTS "crm_leads_priority_idx" ON "crm_leads"("priority");`,
    `CREATE INDEX IF NOT EXISTS "crm_leads_source_idx" ON "crm_leads"("source");`,
    `CREATE INDEX IF NOT EXISTS "crm_leads_assignedUserId_idx" ON "crm_leads"("assignedUserId");`,
    `CREATE INDEX IF NOT EXISTS "crm_leads_campaignId_idx" ON "crm_leads"("campaignId");`,
    `CREATE INDEX IF NOT EXISTS "crm_leads_createdAt_idx" ON "crm_leads"("createdAt");`,
    `CREATE INDEX IF NOT EXISTS "crm_leads_nextFollowUpAt_idx" ON "crm_leads"("nextFollowUpAt");`,
    `CREATE INDEX IF NOT EXISTS "crm_leads_isConverted_idx" ON "crm_leads"("isConverted");`,
    `CREATE INDEX IF NOT EXISTS "crm_leads_duplicateOfId_idx" ON "crm_leads"("duplicateOfId");`,

    // 4. Lead activities
    `CREATE TABLE IF NOT EXISTS "crm_lead_activities" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "leadId" TEXT NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
      "type" "CRMActivityType" NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "metadata" JSONB,
      "performedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS "crm_lead_activities_leadId_createdAt_idx" ON "crm_lead_activities"("leadId", "createdAt");`,

    // 5. Follow ups
    `CREATE TABLE IF NOT EXISTS "crm_lead_follow_ups" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "leadId" TEXT NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
      "counsellorId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "type" "CRMFollowUpType" NOT NULL DEFAULT 'PHONE_CALL',
      "priority" "CRMLeadPriority" NOT NULL DEFAULT 'WARM',
      "status" "CRMFollowUpStatus" NOT NULL DEFAULT 'PENDING',
      "scheduledAt" TIMESTAMP(3) NOT NULL,
      "completedAt" TIMESTAMP(3),
      "outcome" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS "crm_lead_follow_ups_leadId_idx" ON "crm_lead_follow_ups"("leadId");`,
    `CREATE INDEX IF NOT EXISTS "crm_lead_follow_ups_counsellorId_idx" ON "crm_lead_follow_ups"("counsellorId");`,
    `CREATE INDEX IF NOT EXISTS "crm_lead_follow_ups_scheduledAt_idx" ON "crm_lead_follow_ups"("scheduledAt");`,
    `CREATE INDEX IF NOT EXISTS "crm_lead_follow_ups_status_idx" ON "crm_lead_follow_ups"("status");`,

    // 6. Call records
    `CREATE TABLE IF NOT EXISTS "crm_call_records" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "leadId" TEXT NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
      "counsellorId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
      "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
      "durationSeconds" INTEGER NOT NULL DEFAULT 0,
      "outcome" "CRMCallOutcome" NOT NULL DEFAULT 'CONNECTED',
      "notes" TEXT,
      "recordingUrl" TEXT,
      "provider" TEXT DEFAULT 'MANUAL',
      "providerCallId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS "crm_call_records_leadId_idx" ON "crm_call_records"("leadId");`,
    `CREATE INDEX IF NOT EXISTS "crm_call_records_counsellorId_idx" ON "crm_call_records"("counsellorId");`,
    `CREATE INDEX IF NOT EXISTS "crm_call_records_createdAt_idx" ON "crm_call_records"("createdAt");`,

    // 7. Counselling sessions
    `CREATE TABLE IF NOT EXISTS "crm_counselling_sessions" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "leadId" TEXT NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
      "counsellorId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
      "scheduledAt" TIMESTAMP(3) NOT NULL,
      "completedAt" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
      "mode" TEXT NOT NULL DEFAULT 'PHONE',
      "meetingLink" TEXT,
      "parentPresent" BOOLEAN NOT NULL DEFAULT false,
      "parentInteractionNotes" TEXT,
      "studentAspirations" TEXT,
      "recommendedCourseId" TEXT,
      "recommendedBatchId" TEXT,
      "outcome" "CRMCounsellingOutcome",
      "counsellingNotes" TEXT,
      "demoClassScheduled" BOOLEAN NOT NULL DEFAULT false,
      "demoClassDate" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS "crm_counselling_sessions_leadId_idx" ON "crm_counselling_sessions"("leadId");`,
    `CREATE INDEX IF NOT EXISTS "crm_counselling_sessions_counsellorId_idx" ON "crm_counselling_sessions"("counsellorId");`,
    `CREATE INDEX IF NOT EXISTS "crm_counselling_sessions_scheduledAt_idx" ON "crm_counselling_sessions"("scheduledAt");`,

    // 8. Assignment rules
    `CREATE TABLE IF NOT EXISTS "crm_assignment_rules" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "targetExam" TEXT,
      "medium" TEXT,
      "studentClass" TEXT,
      "state" TEXT,
      "assignedUserId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "maxActiveLeads" INTEGER NOT NULL DEFAULT 100,
      "priority" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS "crm_assignment_rules_assignedUserId_idx" ON "crm_assignment_rules"("assignedUserId");`,
    `CREATE INDEX IF NOT EXISTS "crm_assignment_rules_isActive_idx" ON "crm_assignment_rules"("isActive");`,

    // 9. Communication logs
    `CREATE TABLE IF NOT EXISTS "crm_communication_logs" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "leadId" TEXT NOT NULL REFERENCES "crm_leads"("id") ON DELETE CASCADE,
      "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
      "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
      "senderUserId" TEXT,
      "recipient" TEXT NOT NULL,
      "templateName" TEXT,
      "messageContent" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'SENT',
      "providerId" TEXT,
      "errorMessage" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS "crm_communication_logs_leadId_idx" ON "crm_communication_logs"("leadId");`,
    `CREATE INDEX IF NOT EXISTS "crm_communication_logs_channel_idx" ON "crm_communication_logs"("channel");`,
    `CREATE INDEX IF NOT EXISTS "crm_communication_logs_createdAt_idx" ON "crm_communication_logs"("createdAt");`,
  ];

  for (const query of queries) {
    try {
      await prisma.$executeRawUnsafe(query);
    } catch (e: any) {
      console.error("Query failed:", query.slice(0, 60), "Error:", e.message);
      throw e;
    }
  }

  console.log("All CRM tables and enums created successfully with ZERO data loss!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
