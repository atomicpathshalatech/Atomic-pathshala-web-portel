-- Module Studio: saved design templates (additive; no existing table changes)
CREATE TABLE "module_design_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "data" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_design_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "module_design_templates_createdAt_idx" ON "module_design_templates"("createdAt");
