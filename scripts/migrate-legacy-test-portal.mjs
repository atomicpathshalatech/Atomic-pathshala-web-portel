#!/usr/bin/env node
/**
 * One-time migration: legacy Atomic Test Portal (old standalone Supabase
 * database, see _import-test-portal/prisma/schema.prisma) -> the merged
 * atomic-ops schema (current Neon database, prisma/schema.prisma).
 *
 * SCOPE — content only, on purpose:
 *   TestSeries -> Question (+QuestionTranslation) -> Test -> Section ->
 *   SectionQuestion -> Dpp -> DppQuestion
 *
 * Deliberately NOT migrated — old-product runtime/user data that doesn't
 * belong in the new app's own auth/RBAC/analytics, or that the new schema
 * has no matching home for:
 *   User, Attempt, AttemptAnswer, AttemptViolation, Doubt, Notification,
 *   AuditLog, DeviceSession, LoginAttempt, PasswordHistory/ResetToken,
 *   Bookmark, QuestionVersion, QuestionReport, RankTrendPoint,
 *   CollegeAllotment, TestTemplate/TestTemplateSection, DailyMessage,
 *   DailyCheckIn, SecurityConfig, ScheduledJobLog, and the old Module/
 *   ModulePage/BrandProfile/ProcessingJob/ModuleExport rows (Module Studio
 *   content — a separate decision; this script does not touch them).
 *
 * Known, deliberate lossy conversions:
 *   - createdById / publishedById are always left null on migrated rows.
 *     The old User ids mean nothing in the new database's own user table —
 *     pointing them at a real-but-wrong new user would be worse than
 *     honestly dropping authorship on legacy content.
 *   - Archived questions (old Question.archived = true) are skipped.
 *   - Old Test.chapter was a free-text string; the new Test only has a
 *     real chapterId FK into Chapter Management, which this script cannot
 *     safely auto-resolve (no reliable name match). The old free-text
 *     value is preserved as a "[Legacy chapter: X]" prefix on the new
 *     Test's description instead of being silently dropped.
 *
 * IDEMPOTENT / RESUMABLE: every successfully migrated row's old id -> new
 * id mapping is written to scripts/.migration-state.json immediately after
 * that row is created. Re-running the script (dry-run or live) picks up
 * from that file and skips anything already migrated, so a crash or a
 * Ctrl+C partway through is safe to just re-run.
 *
 * Usage (run this from the project root, in your own terminal — it needs
 * real internet access to both databases, which this sandboxed shell does
 * not have):
 *   node scripts/migrate-legacy-test-portal.mjs --dry-run   (read-only report, no writes)
 *   node scripts/migrate-legacy-test-portal.mjs             (actually migrates)
 */
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const DRY_RUN = process.argv.includes("--dry-run");
const STATE_PATH = path.join(process.cwd(), "scripts", ".migration-state.json");

function getEnvVar(name) {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const line = text.split(/\r?\n/).find((l) => l.startsWith(name + "="));
    if (line) return line.slice(name.length + 1).trim().replace(/^"|"$/g, "");
  }
  return process.env[name] ?? null;
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) {
    return { testSeries: {}, questions: {}, tests: {}, sections: {}, dpps: {}, questionTranslations: {}, sectionQuestions: {}, dppQuestions: {} };
  }
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

const oldUrl = getEnvVar("OLD_SUPABASE_DATABASE_URL");
if (!oldUrl) {
  console.error("OLD_SUPABASE_DATABASE_URL not set in .env.local / .env — see earlier setup step.");
  process.exit(1);
}

const old = new pg.Client({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
const prisma = new PrismaClient();
const state = loadState();
const counts = {};
function bump(key, n = 1) { counts[key] = (counts[key] ?? 0) + n; }

async function main() {
  await old.connect();
  console.log(DRY_RUN ? "=== DRY RUN (read-only, no writes) ===" : "=== LIVE MIGRATION ===");

  const tableNames = ["TestSeries", "Test", "Section", "SectionQuestion", "Question", "QuestionTranslation", "Dpp", "DppQuestion"];
  for (const t of tableNames) {
    const r = await old.query(`SELECT COUNT(*) FROM "${t}"`);
    console.log(`old."${t}": ${r.rows[0].count} rows`);
  }
  const archived = await old.query(`SELECT COUNT(*) FROM "Question" WHERE archived = true`);
  console.log(`old."Question" archived (will be skipped): ${archived.rows[0].count}`);
  const alreadyDone = Object.keys(state.questions).length + Object.keys(state.tests).length + Object.keys(state.testSeries).length + Object.keys(state.dpps).length;
  console.log(`Already migrated in a previous run (per scripts/.migration-state.json): ${alreadyDone} top-level rows`);

  if (DRY_RUN) {
    for (const t of tableNames) {
      const r = await old.query(`SELECT * FROM "${t}" LIMIT 1`);
      if (r.rows[0]) console.log(`sample columns for "${t}":`, Object.keys(r.rows[0]).join(", "));
    }
    console.log("\nDry run only — no writes performed. Re-run without --dry-run to migrate for real.");
    return;
  }

  // ---------------- TestSeries ----------------
  const seriesRows = (await old.query(`SELECT * FROM "TestSeries"`)).rows;
  for (const s of seriesRows) {
    if (state.testSeries[s.id]) continue;
    const row = await prisma.testSeries.upsert({
      where: { code: s.code },
      update: {},
      create: {
        name: s.name,
        code: s.code,
        description: s.description,
        targetBatch: s.targetBatch,
        className: s.className,
        course: s.course,
        examType: s.examType,
        tags: s.tags,
        thumbnailUrl: s.thumbnailUrl,
        visibility: s.visibility ?? "PRIVATE",
        startDate: s.startDate,
        endDate: s.endDate,
        createdAt: s.createdAt,
      },
    });
    state.testSeries[s.id] = row.id;
    saveState(state);
    bump("testSeries");
  }
  console.log(`TestSeries migrated: ${counts.testSeries ?? 0} (of ${seriesRows.length})`);

  // ---------------- Question + QuestionTranslation ----------------
  const questionRows = (await old.query(`SELECT * FROM "Question" WHERE archived IS NOT TRUE`)).rows;
  for (const q of questionRows) {
    let newQuestionId = state.questions[q.id];
    if (!newQuestionId) {
      const data = {
        subject: q.subject,
        chapter: q.chapter,
        topic: q.topic,
        subTopic: q.subTopic,
        type: q.type,
        difficulty: q.difficulty,
        imageUrl: q.imageUrl,
        category: q.category,
        pyqSource: q.pyqSource,
        solution: q.solution,
        tags: q.tags,
        usageCount: q.usageCount ?? 0,
        isPublished: q.isPublished ?? false,
        publishedAt: q.publishedAt,
        createdAt: q.createdAt,
      };
      const row = q.questionCode
        ? await prisma.question.upsert({ where: { questionCode: q.questionCode }, update: {}, create: { ...data, questionCode: q.questionCode } })
        : await prisma.question.create({ data });
      newQuestionId = row.id;
      state.questions[q.id] = newQuestionId;
      saveState(state);
      bump("questions");
    }

    const translations = (await old.query(`SELECT * FROM "QuestionTranslation" WHERE "questionId" = $1`, [q.id])).rows;
    for (const tr of translations) {
      const key = `${q.id}:${tr.language}`;
      if (state.questionTranslations[key]) continue;
      await prisma.questionTranslation.upsert({
        where: { questionId_language: { questionId: newQuestionId, language: tr.language } },
        update: {},
        create: {
          questionId: newQuestionId,
          language: tr.language,
          statement: tr.statement,
          options: tr.options,
          correctOptionIds: tr.correctOptionIds,
          solution: tr.solution,
        },
      });
      state.questionTranslations[key] = true;
      saveState(state);
      bump("questionTranslations");
    }
  }
  console.log(`Questions migrated: ${counts.questions ?? 0} (of ${questionRows.length} non-archived)`);
  console.log(`Question translations migrated: ${counts.questionTranslations ?? 0}`);

  // ---------------- Test ----------------
  const testRows = (await old.query(`SELECT * FROM "Test"`)).rows;
  for (const t of testRows) {
    if (state.tests[t.id]) continue;
    const testSeriesId = state.testSeries[t.testSeriesId] ?? null;
    let description = t.description ?? "";
    if (t.chapter) description = `[Legacy chapter: ${t.chapter}] ${description}`.trim();
    const data = {
      testSeriesId,
      name: t.name,
      languageMode: t.languageMode,
      durationMin: t.durationMin,
      openTime: t.openTime,
      closeTime: t.closeTime,
      correctMarks: t.correctMarks,
      incorrectMarks: t.incorrectMarks,
      negativeMarkingEnabled: t.negativeMarkingEnabled ?? true,
      questionFormat: t.questionFormat ?? "OBJECTIVE",
      testType: t.testType,
      examType: t.examType,
      description: description || null,
      instructions: t.instructions,
      status: t.status,
      archived: t.archived ?? false,
      createdAt: t.createdAt,
    };
    const row = t.code
      ? await prisma.test.upsert({ where: { code: t.code }, update: {}, create: { ...data, code: t.code } })
      : await prisma.test.create({ data });
    state.tests[t.id] = row.id;
    saveState(state);
    bump("tests");
  }
  console.log(`Tests migrated: ${counts.tests ?? 0} (of ${testRows.length})`);

  // ---------------- Section ----------------
  const sectionRows = (await old.query(`SELECT * FROM "Section"`)).rows;
  for (const sec of sectionRows) {
    if (state.sections[sec.id]) continue;
    const testId = state.tests[sec.testId];
    if (!testId) { console.warn(`skip Section ${sec.id}: parent Test ${sec.testId} was not migrated`); continue; }
    let row = await prisma.section.findFirst({ where: { testId, name: sec.name, order: sec.order } });
    if (!row) {
      row = await prisma.section.create({
        data: {
          testId,
          name: sec.name,
          order: sec.order ?? 0,
          subject: sec.subject,
          targetCount: sec.targetCount ?? 0,
          marksPerQuestion: sec.marksPerQuestion,
          negativeMarks: sec.negativeMarks,
        },
      });
    }
    state.sections[sec.id] = row.id;
    saveState(state);
    bump("sections");
  }
  console.log(`Sections migrated: ${counts.sections ?? 0} (of ${sectionRows.length})`);

  // ---------------- SectionQuestion ----------------
  const sqRows = (await old.query(`SELECT * FROM "SectionQuestion"`)).rows;
  for (const sq of sqRows) {
    const key = sq.id;
    if (state.sectionQuestions[key]) continue;
    const sectionId = state.sections[sq.sectionId];
    const questionId = state.questions[sq.questionId];
    if (!sectionId || !questionId) { console.warn(`skip SectionQuestion ${sq.id}: parent Section or Question not migrated (likely an archived question)`); continue; }
    await prisma.sectionQuestion.upsert({
      where: { sectionId_questionId: { sectionId, questionId } },
      update: {},
      create: {
        sectionId,
        questionId,
        order: sq.order ?? 0,
        marksOverride: sq.marksOverride,
        negativeMarksOverride: sq.negativeMarksOverride,
        reviewStatus: sq.reviewStatus ?? "PENDING",
      },
    });
    state.sectionQuestions[key] = true;
    saveState(state);
    bump("sectionQuestions");
  }
  console.log(`SectionQuestions migrated: ${counts.sectionQuestions ?? 0} (of ${sqRows.length})`);

  // ---------------- Dpp ----------------
  const dppRows = (await old.query(`SELECT * FROM "Dpp"`)).rows;
  for (const d of dppRows) {
    if (state.dpps[d.id]) continue;
    const data = {
      name: d.name,
      subject: d.subject,
      chapter: d.chapter,
      facultyName: d.facultyName,
      difficulty: d.difficulty ?? "MEDIUM",
      languageMode: d.languageMode,
      description: d.description,
      tags: d.tags,
      instructions: d.instructions,
      estimatedTimeMin: d.estimatedTimeMin ?? 30,
      correctMarks: d.correctMarks,
      incorrectMarks: d.incorrectMarks,
      negativeMarkingEnabled: d.negativeMarkingEnabled ?? true,
      questionTargetCount: d.questionTargetCount ?? 0,
      status: d.status ?? "DRAFT",
      level: d.level,
      topics: d.topics ?? [],
      createdAt: d.createdAt,
    };
    const row = await prisma.dpp.upsert({ where: { code: d.code }, update: {}, create: { ...data, code: d.code } });
    state.dpps[d.id] = row.id;
    saveState(state);
    bump("dpps");
  }
  console.log(`Dpps migrated: ${counts.dpps ?? 0} (of ${dppRows.length})`);

  // ---------------- DppQuestion ----------------
  const dqRows = (await old.query(`SELECT * FROM "DppQuestion"`)).rows;
  for (const dq of dqRows) {
    const key = dq.id;
    if (state.dppQuestions[key]) continue;
    const dppId = state.dpps[dq.dppId];
    const questionId = state.questions[dq.questionId];
    if (!dppId || !questionId) { console.warn(`skip DppQuestion ${dq.id}: parent Dpp or Question not migrated`); continue; }
    const existing = await prisma.dppQuestion.findFirst({ where: { dppId, questionId } });
    if (!existing) {
      await prisma.dppQuestion.create({ data: { dppId, questionId, order: dq.order ?? 0 } });
    }
    state.dppQuestions[key] = true;
    saveState(state);
    bump("dppQuestions");
  }
  console.log(`DppQuestions migrated: ${counts.dppQuestions ?? 0} (of ${dqRows.length})`);

  console.log("\n=== DONE ===");
  console.log(JSON.stringify(counts, null, 2));
  console.log(`State checkpoint saved to ${STATE_PATH} — safe to re-run this script any time, already-migrated rows are skipped.`);
}

main()
  .catch((e) => {
    console.error("MIGRATION ERROR:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await old.end().catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });
