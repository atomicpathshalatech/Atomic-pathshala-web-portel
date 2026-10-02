-- DPP hierarchy fields (Class / Exam / Topic / Sub-topic / DPP number) for the
-- PDF front page. All nullable: existing DPPs are unchanged.
ALTER TABLE "dpps" ADD COLUMN "dppNumber" INTEGER;
ALTER TABLE "dpps" ADD COLUMN "className" TEXT;
ALTER TABLE "dpps" ADD COLUMN "exam" TEXT;
ALTER TABLE "dpps" ADD COLUMN "topic" TEXT;
ALTER TABLE "dpps" ADD COLUMN "subTopic" TEXT;

-- Links printed on every DPP PDF front page (YouTube / Telegram QR, website).
CREATE TABLE "dpp_brand_settings" (
    "id" TEXT NOT NULL,
    "tagline" TEXT,
    "youtubeUrl" TEXT,
    "telegramUrl" TEXT,
    "websiteUrl" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dpp_brand_settings_pkey" PRIMARY KEY ("id")
);
