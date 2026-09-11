/** Standalone: seeds just the default EmailTemplate rows. Safe to re-run (upsert, never clobbers an existing row's content). */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_EMAIL_TEMPLATES } from "../src/lib/email/defaults";

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
  for (const t of DEFAULT_EMAIL_TEMPLATES) {
    await rt(() =>
      prisma.emailTemplate.upsert({
        where: { key: t.key },
        update: {},
        create: {
          key: t.key,
          name: t.name,
          category: t.category,
          subject: t.subject,
          bodyHtml: t.bodyHtml,
          variables: t.variables,
          isSystem: true,
        },
      })
    );
    console.log("seeded:", t.key);
  }
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
