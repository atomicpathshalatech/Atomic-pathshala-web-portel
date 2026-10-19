/**
 * The PYQ migration must complete on any database state it can meet:
 *   A. the pre-PYQ schema (normal deploy),
 *   B. a database where the PYQ objects already exist (e.g. made by
 *      `prisma db push`) and a "neet-ug" exam row exists under another id,
 *   C. a second run on top of A.
 * Each case must end with no drift from prisma/schema.prisma.
 *
 *   TEST_DATABASE_URL="postgresql://postgres@localhost:5433/atomic_test" \
 *     npx tsx --conditions=react-server scripts/test-pyq-migration.ts
 */
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAsserts, requireTestDatabase } from "./lib/test-db";

const { testUrl } = requireTestDatabase();
const { assert, finish } = createAsserts();
const env = { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl };
const sh = (cmd: string) => execSync(cmd, { env, stdio: "pipe" }).toString();
const MIGRATION = "prisma/migrations/20261018000000_pyq_library/migration.sql";

function drift(): string {
  try {
    sh(`npx prisma migrate diff --from-url "${testUrl}" --to-schema-datamodel prisma/schema.prisma --exit-code`);
    return "";
  } catch (e: any) {
    return String(e.stdout ?? e.message).slice(0, 300);
  }
}
function migrate(): string {
  try {
    sh(`npx prisma db execute --file ${MIGRATION} --schema prisma/schema.prisma`);
    return "";
  } catch (e: any) {
    return String(e.stderr ?? e.message).slice(0, 300);
  }
}

async function main() {
  const base = sh("git merge-base HEAD origin/main").trim();
  const dir = mkdtempSync(join(tmpdir(), "pyq-mig-"));
  const baseSchema = join(dir, "schema.prisma");
  writeFileSync(baseSchema, sh(`git show ${base}:prisma/schema.prisma`));
  const { prisma } = await import("../src/lib/db");

  // A + C
  sh(`npx prisma db push --force-reset --skip-generate --accept-data-loss --schema "${baseSchema}"`);
  let err = migrate();
  assert(err === "", "A. Applies on the pre-PYQ schema", err);
  // The Exercise Builder migration ships alongside; with it the schema is complete.
  sh(`npx prisma db execute --file prisma/migrations/20261019000000_exercise_builder/migration.sql --schema prisma/schema.prisma`);
  assert(drift() === "", "A. No drift afterwards");
  err = migrate();
  assert(err === "", "C. A second run succeeds (idempotent)", err);
  assert(drift() === "", "C. Still no drift");
  assert((await prisma.pyqExam.count()) === 3, "C. Still exactly three seeded exams");

  // B
  sh(`npx prisma db push --force-reset --skip-generate --accept-data-loss --schema prisma/schema.prisma`);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "pyq_exams" ("id","slug","name","canonicalType","aliases","legacyCode","sortOrder","isActive","createdAt","updatedAt") VALUES ('cmexisting000neet','neet-ug','NEET UG','NEET_UG','{}','NEET',100,true,now(),now())`
  );
  err = migrate();
  assert(err === "", "B. Applies when every PYQ object already exists", err);
  assert(drift() === "", "B. No drift afterwards");
  const neet = await prisma.pyqExam.findUniqueOrThrow({ where: { slug: "neet-ug" } });
  assert(neet.id === "cmexisting000neet", "B. The existing NEET UG row keeps its id (rows that reference it stay valid)");
  assert(neet.aliases.includes("aipmt") && neet.aliases.includes("neet") && neet.sortOrder === 10, "B. …and gets the standard aliases / order", JSON.stringify(neet));
  assert((await prisma.pyqExam.count({ where: { slug: { in: ["jee-main", "jee-advanced"] } } })) === 2, "B. JEE Main / Advanced added");

  // Tag detection must use the real id, not the seeded one.
  const { examPatterns } = await import("../src/lib/pyq/exams-service");
  const { findExamTags } = await import("../src/lib/pyq/metadata-detect");
  const tag = findExamTags("Which is right? [NEET 2019]", await examPatterns())[0];
  assert(tag?.examId === "cmexisting000neet", "Tag detection links to the database's NEET UG row", tag?.examId ?? "none");

  await prisma.$disconnect();
}

main()
  .then(() => finish())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
