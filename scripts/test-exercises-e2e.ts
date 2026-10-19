/**
 * Exercise Builder end to end, over HTTP against a running LOCAL server:
 * build an exercise from question-bank ids, regroup, export the PDF, publish,
 * and practise it as a student — plus who may open what.
 *
 *   E2E_BASE=http://localhost:3112 TEST_DATABASE_URL=postgresql://…localhost…/db \
 *     npx tsx --tsconfig tsconfig.json scripts/test-exercises-e2e.ts
 *
 * The server must use the same (local) database. Test accounts and questions are
 * created with random ids; nothing here may run against production.
 */
import crypto from "node:crypto";
import { PDFDocument } from "pdf-lib";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { HttpSession } from "./lib/http-session";

const BASE = process.env.E2E_BASE ?? "http://localhost:3112";
const DB = process.env.TEST_DATABASE_URL ?? "";
for (const v of [BASE, DB]) if (!/localhost|127\.0\.0\.1/.test(v)) throw new Error("Refusing to run: E2E_BASE and TEST_DATABASE_URL must be local.");
const prisma = new PrismaClient({ datasources: { db: { url: DB } } });

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && !ok ? `  — ${detail}` : ""}`);
};

async function userWithRole(role: string) {
  const r = await prisma.role.findFirst({ where: { name: role } });
  if (!r) throw new Error(`role ${role} missing — seed the local database`);
  const password = crypto.randomBytes(12).toString("base64url");
  const user = await prisma.user.create({ data: { email: `e2e-ex-${role.toLowerCase()}-${Date.now()}-${crypto.randomUUID().slice(0, 4)}@test.local`, name: `E2E ${role}`, passwordHash: await bcrypt.hash(password, 10), roleId: r.id, status: "ACTIVE" } as any });
  const s = new HttpSession(BASE);
  await s.login(user.email, password);
  return { s, user };
}

async function seedQuestions(tag: string) {
  const rows = [
    { topic: "Alkanes", en: "Write the IUPAC name of CH3-CH(CH3)-CH3.", hi: "CH3-CH(CH3)-CH3 का IUPAC नाम लिखिए।", ans: "B" },
    { topic: "Alkenes", en: "Which of these is but-2-ene?", hi: "इनमें से कौन ब्यूट-2-ईन है?", ans: "C" },
    { topic: "Alkanes", en: "How many carbon atoms are in 2,2-dimethylpropane?", hi: "2,2-डाइमेथिलप्रोपेन में कितने कार्बन परमाणु हैं?", ans: "D" },
    { topic: "Alcohols", en: "The IUPAC name of CH3CH2OH is", hi: "CH3CH2OH का IUPAC नाम है", ans: "A" },
  ];
  const ids: string[] = [];
  for (const [i, r] of rows.entries()) {
    const id = `e2e_ex_${tag}_${i}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "questions" ("id","questionCode","subject","chapter","topic","isPublished","status","solution") VALUES ($1,$2,'Chemistry','IUPAC Nomenclature',$3,true,'PUBLISHED',$4)`,
      id, `E2E-${tag}-${i}`, r.topic, `Solution for question ${i + 1}`
    );
    for (const [lang, text] of [["ENGLISH", r.en], ["HINDI", r.hi]] as const) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "question_translations" ("id","questionId","language","statement","options","correctOptionIds","solution") VALUES ($1,$2,$3,$4,'{"A":"one","B":"two","C":"three","D":"four"}',$5::jsonb,$6)`,
        `tr_${id}_${lang}`, id, lang, text, JSON.stringify([r.ans]), `Because ${r.ans}.`
      );
    }
    ids.push(id);
  }
  return ids;
}

(async () => {
  const tag = crypto.randomUUID().slice(0, 6);
  const { s: admin } = await userWithRole("SUPER_ADMIN");
  const { s: student } = await userWithRole("STUDENT");
  const { s: sales } = await userWithRole("SALES");
  const anon = new HttpSession(BASE);
  const qids = await seedQuestions(tag);

  // ── build
  const cr = await admin.json("/api/team/exercises", { method: "POST", body: JSON.stringify({ title: `E2E IUPAC ${tag}`, subject: "Chemistry", chapter: "IUPAC Nomenclature", languageMode: "BILINGUAL" }) });
  const ex = cr.body?.data?.exercise ?? cr.body?.data;
  check("team member creates an exercise", (cr.status === 200 || cr.status === 201) && !!ex?.id, `${cr.status} ${JSON.stringify(cr.body).slice(0, 160)}`);
  const id = ex.id as string;
  const sa = await sales.json("/api/team/exercises", { method: "POST", body: JSON.stringify({ title: "x", subject: "Chemistry", chapter: "x" }) });
  check("SALES cannot create exercises (403)", sa.status === 403, String(sa.status));

  const imp = await admin.json(`/api/team/exercises/${id}/import-ids`, { method: "POST", body: JSON.stringify({ rawInput: `${qids[0]}, E2E-${tag}-1\n${qids[2]} ${qids[3]} not_a_question` }) });
  const r = imp.body?.data;
  check("import by id and by question code", r?.importedCount === 4 && r?.invalidCount === 1, JSON.stringify(r).slice(0, 200));
  const dup = await admin.json(`/api/team/exercises/${id}/import-ids`, { method: "POST", body: JSON.stringify({ rawInput: qids.join(",") }) });
  check("importing again adds nothing (no duplicates)", dup.body?.data?.importedCount === 0 && dup.body?.data?.alreadyIncludedCount === 4, JSON.stringify(dup.body?.data).slice(0, 160));
  check("question bank untouched", (await prisma.question.count({ where: { id: { in: qids } } })) === 4);

  const rg = await admin.json(`/api/team/exercises/${id}/regroup`, { method: "POST", body: "{}" });
  const sections = await prisma.exerciseSection.findMany({ where: { exerciseId: id }, include: { _count: { select: { questions: true } } } });
  check("regroup by topic: one section per topic", rg.status === 200 && sections.length === 3 && sections.reduce((n, s) => n + s._count.questions, 0) === 4, sections.map((s) => `${s.title}:${s._count.questions}`).join(", "));

  // ── PDF
  const t0 = Date.now();
  const pdfRes = await admin.fetch(`/api/team/exercises/${id}/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ languageMode: "BILINGUAL", format: "FULL_WITH_SOLUTIONS" }) });
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  const pdf = await PDFDocument.load(pdfBuf).catch(() => null);
  check("bilingual PDF exports and opens", pdfRes.status === 200 && !!pdf && pdf.getPageCount() > 0, `${pdfRes.status} ${pdfBuf.length} bytes in ${Date.now() - t0} ms`);
  check("export recorded", (await prisma.exerciseExport.count({ where: { exerciseId: id } })) === 1);

  // ── student: draft is hidden, published opens (signed in only)
  const draft = await student.json(`/api/student/exercises/${id}`);
  check("student cannot open a draft exercise (404)", draft.status === 404, String(draft.status));
  const draftAttempt = await student.json(`/api/student/exercises/${id}/attempt`, { method: "POST", body: JSON.stringify({ answers: {} }) });
  check("student cannot submit a draft exercise (404)", draftAttempt.status === 404, String(draftAttempt.status));
  const pub = await admin.json(`/api/team/exercises/${id}`, { method: "PATCH", body: JSON.stringify({ status: "PUBLISHED" }) });
  check("publish", pub.status === 200);
  const op = await student.json(`/api/student/exercises/${id}`);
  const qs = (op.body?.data?.exercise?.sections ?? []).flatMap((s: any) => s.questions.map((q: any) => q.question));
  check("student opens the published exercise", op.status === 200 && qs.length === 4, String(op.status));
  const keys = new Set(qs.flatMap((q: any) => Object.keys(q)));
  check("only the fields the practice page needs are sent", !keys.has("reviewNotes") && !keys.has("createdById") && !keys.has("sourceText") && keys.has("translations") && keys.has("solution"), [...keys].join(","));
  check("signed out: 401", (await anon.json(`/api/student/exercises/${id}`)).status === 401);

  const answers = Object.fromEntries(qs.map((q: any) => [q.id, q.id === qids[0] ? "B" : "A"]));
  const at = await student.json(`/api/student/exercises/${id}/attempt`, { method: "POST", body: JSON.stringify({ answers, timeSpentSeconds: 42, mode: "PRACTICE" }) });
  const res = at.body?.data;
  check("attempt graded on the server", at.status === 200 && typeof JSON.stringify(res) === "string" && (await prisma.exerciseAttempt.count({ where: { exerciseId: id } })) === 1, `${at.status} ${JSON.stringify(at.body).slice(0, 200)}`);
  const attempt = await prisma.exerciseAttempt.findFirst({ where: { exerciseId: id }, include: { answers: true } });
  const right = attempt?.answers.filter((a: any) => a.isCorrect).length;
  check("grading is right (q1 B ✓, q4 A ✓, others ✗)", right === 2, JSON.stringify(attempt?.answers.map((a: any) => [a.questionId.slice(-1), a.selectedOption ?? a.selectedOptions, a.isCorrect])));

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
