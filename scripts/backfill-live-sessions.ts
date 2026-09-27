/**
 * Backfills one LiveSession (occurrence 1) for every existing
 * WhiteboardSession, using the mapping in src/lib/live-session/legacy-map.ts.
 *
 * Safe by default:
 *   - DRY RUN unless --apply is passed; a dry run only reads.
 *   - --apply also requires --confirm-host=<host of DATABASE_URL>, so it can't
 *     be pointed at the wrong database by an env file you forgot was loaded.
 *   - Idempotent: sessions that already have a LiveSession are skipped, and
 *     inserts use skipDuplicates, so re-running is harmless.
 *   - Whiteboard Test Lab sessions (isTest) are skipped.
 *
 * Usage:
 *   npx tsx scripts/backfill-live-sessions.ts
 *   npx tsx scripts/backfill-live-sessions.ts --apply --confirm-host=db.example.com
 *
 * Run AFTER the 20260927120000_live_session_youtube_delivery migration.
 */
import { PrismaClient } from "@prisma/client";
import { mapLegacyLiveSession } from "../src/lib/live-session/legacy-map";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const confirmHost = args.find((a) => a.startsWith("--confirm-host="))?.split("=")[1];
const PAGE = 200;

function databaseHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  return new URL(url).hostname;
}

async function main() {
  const host = databaseHost();
  console.log(`Database host: ${host}`);
  console.log(apply ? "Mode: APPLY" : "Mode: DRY RUN (pass --apply to write)");
  if (apply && confirmHost !== host) {
    throw new Error(`Refusing to write: pass --confirm-host=${host} to confirm this is the database you mean.`);
  }

  const prisma = new PrismaClient();
  const counts: Record<string, number> = {};
  let scanned = 0;
  let created = 0;
  let cursor: string | undefined;

  try {
    for (;;) {
      const page = await prisma.whiteboardSession.findMany({
        where: { isTest: false, liveSessions: { none: {} } },
        include: { batchSchedule: { select: { id: true, startsAt: true, endsAt: true } } },
        orderBy: { id: "asc" },
        take: PAGE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (page.length === 0) break;
      cursor = page[page.length - 1]!.id;
      scanned += page.length;

      const rows = page.map((wb) => mapLegacyLiveSession(wb, wb.batchSchedule));
      for (const r of rows) {
        const key = `${r.deliveryMode}/${r.state}`;
        counts[key] = (counts[key] ?? 0) + 1;
      }

      if (apply) {
        const res = await prisma.liveSession.createMany({ data: rows, skipDuplicates: true });
        created += res.count;
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(`Scanned ${scanned} whiteboard sessions without a LiveSession.`);
  console.table(counts);
  console.log(apply ? `Created ${created} LiveSession rows.` : "Dry run — nothing written.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
