/**
 * Seeds the default CreativeTemplate (one per CreativeType) and
 * CreativeBackground (the named themes) rows so the creative engine has
 * something to render with immediately — the engine also falls back to the
 * in-code defaults (lib/creative/default-templates.ts,
 * lib/creative/background-types.ts DEFAULT_THEMES) if these rows are
 * missing, so re-running this is optional, not required, but gives admins
 * something to see/duplicate/edit on the Templates page from day one.
 *
 * Safe to re-run — everything is upserted by a stable key.
 *
 * Usage: npx tsx scripts/seed-creative-templates.ts
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_TEMPLATES_BY_TYPE } from "../src/lib/creative/default-templates";
import { DEFAULT_THEMES } from "../src/lib/creative/background-types";

const prisma = new PrismaClient();

async function main() {
  for (const [type, layoutConfig] of Object.entries(DEFAULT_TEMPLATES_BY_TYPE)) {
    const key = `default_${type.toLowerCase()}`;
    await prisma.creativeTemplate.upsert({
      where: { key },
      update: { layoutConfig: layoutConfig as object },
      create: {
        key,
        name: `Default ${type.replace(/_/g, " ")}`,
        type: type as never,
        layoutConfig: layoutConfig as object,
        isActive: true,
        isDefault: true,
      },
    });
    console.log(`  template: ${key}`);
  }

  for (const theme of DEFAULT_THEMES) {
    const existing = await prisma.creativeBackground.findFirst({ where: { name: theme.name } });
    if (existing) {
      await prisma.creativeBackground.update({ where: { id: existing.id }, data: { value: theme.value as object } });
    } else {
      await prisma.creativeBackground.create({
        data: {
          name: theme.name,
          kind: theme.value.kind,
          value: theme.value as object,
          isActive: true,
          isDefault: theme.key === "dark",
        },
      });
    }
    console.log(`  background: ${theme.name}`);
  }

  console.log("Creative templates + backgrounds seeded.");
}

main()
  .catch((e) => {
    console.error("SEED FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
