/**
 * One-off: chapter modules get the standard exercise names and set.
 *  - "Exercise 3 — NEET PYQs" → "Exercise 3" (only titles that start "Exercise <n>")
 *  - every chapter gets the standard exercises it is missing (incl. NCERT & NCERT Exemplar)
 *
 *   npx tsx scripts/standardize-exercise-names.ts          (dry run: prints the changes)
 *   npx tsx scripts/standardize-exercise-names.ts --apply  (makes them)
 */
import { prisma } from "@/lib/db";
import { ensureChapterModule } from "@/lib/exercises/exercise-service";
import { STANDARD_EXERCISES } from "@/lib/exercises/standard-exercises";

const apply = process.argv.includes("--apply");

async function main() {
  const exercises = await prisma.exercise.findMany({
    select: { id: true, title: true, subject: true, chapter: true, exerciseType: true, createdById: true },
  });

  const renames = exercises
    .map((e) => ({ e, m: e.title.trim().match(/^Exercise\s*(\d+)\s*[—–:\-]\s*\S/i) }))
    .filter((x) => x.m)
    .map(({ e, m }) => ({ id: e.id, from: e.title, to: `Exercise ${m![1]}` }));

  const chapters = new Map<string, { subject: string; chapter: string; titles: string[]; types: string[]; userId: string | null }>();
  for (const e of exercises) {
    const key = `${e.subject.trim().toLowerCase()}:::${e.chapter.trim().toLowerCase()}`;
    const c = chapters.get(key) ?? { subject: e.subject, chapter: e.chapter, titles: [], types: [], userId: e.createdById };
    const renamed = renames.find((r) => r.id === e.id);
    c.titles.push((renamed?.to ?? e.title).trim().toLowerCase());
    c.types.push(e.exerciseType);
    chapters.set(key, c);
  }

  console.log(`${exercises.length} exercises in ${chapters.size} chapters.`);
  console.log(`\nRenames (${renames.length}):`);
  for (const r of renames) console.log(`  "${r.from}" → "${r.to}"`);

  console.log(`\nMissing standard exercises:`);
  let missingTotal = 0;
  for (const c of chapters.values()) {
    const missing = STANDARD_EXERCISES.filter((std) => {
      const want = std.title.toLowerCase();
      if (want.startsWith("exercise ")) return !c.titles.some((t) => t === want || new RegExp(`^${want}\\b(?!\\d)`).test(t));
      return !c.titles.includes(want) && !c.types.includes("NCERT");
    }).map((s) => s.title);
    if (missing.length) {
      missingTotal += missing.length;
      console.log(`  ${c.subject} / ${c.chapter}: ${missing.join(", ")}`);
    }
  }
  console.log(`  (${missingTotal} to create)`);

  if (!apply) {
    console.log("\nDry run — nothing changed. Run with --apply to make these changes.");
    return;
  }

  for (const r of renames) await prisma.exercise.update({ where: { id: r.id }, data: { title: r.to } });
  let created = 0;
  for (const c of chapters.values()) {
    if (!c.userId) continue;
    created += (await ensureChapterModule(c.subject, c.chapter, c.userId)).created;
  }
  console.log(`\nDone: ${renames.length} renamed, ${created} created.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
