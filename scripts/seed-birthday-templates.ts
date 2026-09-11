/** Standalone: seeds the default BirthdayTemplate rows. Safe to re-run (upsert-by-name+category, never overwrites admin edits after first insert — see the `existing` check below). */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_BIRTHDAY_TEMPLATES } from "../src/lib/birthday/defaults";

const prisma = new PrismaClient();

async function rt<T>(fn: () => Promise<T>, n = 6): Promise<T> {
  for (let i = 0; i < n; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === n - 1) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("unreachable");
}

async function main() {
  for (const t of DEFAULT_BIRTHDAY_TEMPLATES) {
    const existing = await rt(() =>
      prisma.birthdayTemplate.findFirst({ where: { name: t.name, category: t.category } })
    );
    if (existing) {
      console.log("already present, skipping:", t.name);
      continue;
    }
    await rt(() =>
      prisma.birthdayTemplate.create({
        data: { name: t.name, category: t.category, messageText: t.messageText, priority: 0 },
      })
    );
    console.log("seeded:", t.name);
  }
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
