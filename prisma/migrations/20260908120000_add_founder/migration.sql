-- Adds the singleton "founder" table backing the homepage "About the
-- Founder" teaser and the /about-founder page. Every text column defaults
-- to '' so a fresh row is invisible on the site until an admin fills it in.

-- CreateTable
CREATE TABLE "founder" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "name" TEXT NOT NULL DEFAULT '',
    "designation" TEXT NOT NULL DEFAULT '',
    "photoUrl" TEXT,
    "mobilePhotoUrl" TEXT,
    "shortBio" TEXT NOT NULL DEFAULT '',
    "biography" TEXT NOT NULL DEFAULT '',
    "education" TEXT NOT NULL DEFAULT '',
    "experience" TEXT NOT NULL DEFAULT '',
    "teachingPhilosophy" TEXT NOT NULL DEFAULT '',
    "vision" TEXT NOT NULL DEFAULT '',
    "founderMessage" TEXT NOT NULL DEFAULT '',
    "socialLinks" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "ogImageUrl" TEXT,
    "canonicalUrl" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "founder_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "founder" ADD CONSTRAINT "founder_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
