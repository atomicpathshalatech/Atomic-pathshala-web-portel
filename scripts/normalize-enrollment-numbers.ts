/**
 * Removes separators from stored enrollment numbers (AP-2026-123456 →
 * AP2026123456) so the database matches what the ID card shows.
 *
 *   npx tsx scripts/normalize-enrollment-numbers.ts                 # dry run (default): report only
 *   npx tsx scripts/normalize-enrollment-numbers.ts --apply         # update, after writing a backup file
 *   npx tsx scripts/normalize-enrollment-numbers.ts --rollback <backup.json>
 *
 * Safety:
 *  - Only the separators change; the digits, and which student owns which
 *    number, never change. Nothing references enrollmentNumber as a key
 *    (it is a plain unique column), so no other table is touched.
 *  - A student is skipped (reported, left unchanged) if the dashless form is
 *    already another student's number, or two students would collapse onto
 *    the same dashless number. The DB unique index is the final backstop.
 *  - --apply writes <cwd>/enrollment-normalize-backup-<timestamp>.json
 *    (id, old, new) BEFORE updating anything; --rollback restores from it.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { formatEnrollmentNumber } from "../src/lib/utils/id-generator";

const prisma = new PrismaClient();

type Change = { id: string; old: string; next: string };

export function planNormalization(rows: { id: string; enrollmentNumber: string }[]) {
  const owner = new Map(rows.map((r) => [r.enrollmentNumber, r.id]));
  const wanted = new Map<string, string[]>();
  const candidates: Change[] = [];
  for (const r of rows) {
    const next = formatEnrollmentNumber(r.enrollmentNumber);
    if (!next || next === r.enrollmentNumber) continue;
    candidates.push({ id: r.id, old: r.enrollmentNumber, next });
    wanted.set(next, [...(wanted.get(next) ?? []), r.id]);
  }
  const changes: Change[] = [];
  const skipped: (Change & { reason: string })[] = [];
  for (const c of candidates) {
    const holder = owner.get(c.next);
    if (holder && holder !== c.id) skipped.push({ ...c, reason: `"${c.next}" already belongs to student ${holder}` });
    else if ((wanted.get(c.next) ?? []).length > 1) skipped.push({ ...c, reason: `several students would become "${c.next}"` });
    else changes.push(c);
  }
  return { changes, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  const rollbackIdx = args.indexOf("--rollback");
  if (rollbackIdx >= 0) {
    const file = args[rollbackIdx + 1];
    if (!file) throw new Error("--rollback needs the backup file path");
    const backup: Change[] = JSON.parse(fs.readFileSync(file, "utf8")).changes;
    let restored = 0;
    for (let i = 0; i < backup.length; i += 200) {
      const chunk = backup.slice(i, i + 200);
      await prisma.$transaction(
        chunk.map((c) => prisma.student.updateMany({ where: { id: c.id, enrollmentNumber: c.next }, data: { enrollmentNumber: c.old } }))
      );
      restored += chunk.length;
    }
    console.log(`Rolled back ${restored} enrollment numbers from ${file}.`);
    return;
  }

  const rows = await prisma.student.findMany({ select: { id: true, enrollmentNumber: true } });
  const { changes, skipped } = planNormalization(rows);
  console.log(`Students: ${rows.length}`);
  console.log(`Already clean: ${rows.length - changes.length - skipped.length}`);
  console.log(`Would change: ${changes.length}`);
  for (const c of changes.slice(0, 10)) console.log(`  ${c.old} → ${c.next}`);
  if (changes.length > 10) console.log(`  … and ${changes.length - 10} more`);
  console.log(`Skipped (conflict): ${skipped.length}`);
  for (const s of skipped) console.log(`  ${s.old}: ${s.reason}`);

  if (!args.includes("--apply")) {
    console.log("\nDry run — nothing changed. Re-run with --apply to update.");
    return;
  }
  if (changes.length === 0) {
    console.log("Nothing to change.");
    return;
  }

  const backupFile = path.resolve(`enrollment-normalize-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ createdAt: new Date().toISOString(), changes, skipped }, null, 2));
  console.log(`\nBackup written: ${backupFile}`);

  let done = 0;
  for (let i = 0; i < changes.length; i += 200) {
    const chunk = changes.slice(i, i + 200);
    // Guarded on the old value, so a row edited meanwhile is left alone.
    await prisma.$transaction(
      chunk.map((c) => prisma.student.updateMany({ where: { id: c.id, enrollmentNumber: c.old }, data: { enrollmentNumber: c.next } }))
    );
    done += chunk.length;
    console.log(`  updated ${done}/${changes.length}`);
  }
  await prisma.auditLog.create({
    data: {
      action: "ENROLLMENT_NUMBERS_NORMALIZED",
      entityType: "Student",
      metadata: { changed: changes.length, skipped: skipped.length, backupFile: path.basename(backupFile) },
    },
  });
  console.log(`Done. ${changes.length} enrollment numbers now have no separators.`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
