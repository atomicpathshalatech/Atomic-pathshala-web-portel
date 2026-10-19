import "server-only";
import type { PyqExam } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeExamKey, slugifyExamName } from "./keys";
import { BUILTIN_EXAM_PATTERNS, patternForExamName, type ExamPattern } from "./metadata-detect";

export class AmbiguousExamError extends Error {
  constructor(public label: string, public candidates: Pick<PyqExam, "id" | "name">[]) {
    super(`"${label}" could mean ${candidates.map((c) => c.name).join(" or ")} — please choose the exam.`);
  }
}

export type ExamResolution =
  | { kind: "match"; exam: PyqExam }
  | { kind: "ambiguous"; candidates: PyqExam[] }
  | { kind: "none" };

/**
 * Finds the configured exam a label refers to. Exact alias / slug / name
 * only — "JEE" alone is ambiguous (Main or Advanced) and an unfamiliar name
 * ("IUPSC") is never folded into NEET or JEE.
 */
export async function resolveExamLabel(label: string): Promise<ExamResolution> {
  const key = normalizeExamKey(label);
  if (!key) return { kind: "none" };
  const exams = await prisma.pyqExam.findMany({ where: { isActive: true } });
  const exact = exams.filter(
    (e) => e.aliases.includes(key) || normalizeExamKey(e.name) === key || e.slug.replace(/-/g, "") === key
  );
  if (exact.length === 1) return { kind: "match", exam: exact[0]! };
  if (exact.length > 1) return { kind: "ambiguous", candidates: exact };
  // "jee" is a prefix of several exams' keys: ask instead of guessing.
  const partial = exams.filter((e) => [normalizeExamKey(e.name), ...e.aliases].some((k) => k.startsWith(key) && key.length >= 3));
  if (partial.length > 1) return { kind: "ambiguous", candidates: partial };
  return { kind: "none" };
}

/** Resolves a label to an exam, creating a custom exam for a new name. */
export async function ensureExam(name: string, userId: string | null): Promise<PyqExam> {
  const clean = String(name || "").trim().replace(/\s+/g, " ");
  if (!clean) throw new Error("Exam name is required.");
  const res = await resolveExamLabel(clean);
  if (res.kind === "match") return res.exam;
  if (res.kind === "ambiguous") throw new AmbiguousExamError(clean, res.candidates);
  const displayName = clean.replace(/\b(19|20)\d{2}\b/g, "").trim() || clean;
  let slug = slugifyExamName(displayName);
  for (let i = 2; await prisma.pyqExam.findUnique({ where: { slug } }); i++) slug = `${slugifyExamName(displayName)}-${i}`;
  return prisma.pyqExam.create({
    data: {
      slug,
      name: displayName,
      canonicalType: "OTHER",
      aliases: [normalizeExamKey(displayName)],
      createdById: userId,
    },
  });
}

/** Adds an alias ("JEE Mains") to an exam so later imports resolve to it. */
export async function addExamAlias(examId: string, alias: string): Promise<PyqExam> {
  const key = normalizeExamKey(alias);
  if (!key) throw new Error("Alias is empty.");
  const clash = await prisma.pyqExam.findFirst({ where: { id: { not: examId }, aliases: { has: key } } });
  if (clash) throw new Error(`"${alias}" already points to ${clash.name}.`);
  const exam = await prisma.pyqExam.findUniqueOrThrow({ where: { id: examId } });
  if (exam.aliases.includes(key)) return exam;
  return prisma.pyqExam.update({ where: { id: examId }, data: { aliases: { push: key } } });
}

/** Patterns for tag detection: custom exams first (more specific), then the built-ins. */
export async function examPatterns(): Promise<ExamPattern[]> {
  const exams = await prisma.pyqExam.findMany({ where: { isActive: true } });
  const bySlug = new Map(exams.map((e) => [e.slug, e]));
  const builtinSlugs = new Set(BUILTIN_EXAM_PATTERNS.map((p) => p.slug));
  const custom = exams.filter((e) => !builtinSlugs.has(e.slug));
  return [
    ...(custom.map((e) => patternForExamName(e.id, e.name)).filter(Boolean) as ExamPattern[]),
    // The row's real id (never a hard-coded one); a missing row leaves the
    // tag detected but flagged "exam not configured" instead of a broken link.
    ...BUILTIN_EXAM_PATTERNS.map((p) => ({ ...p, examId: (p.slug && bySlug.get(p.slug)?.id) || null })),
  ];
}
