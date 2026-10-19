import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatOccurrenceLabel } from "./keys";
import type { ModuleDisplayFormat, RenderItem, RenderModule } from "./module-html";

/**
 * Question Modules: ordered exercises of bank questions (PYQs or any other),
 * custom questions written in the module, and notes. Items reference the
 * canonical Question; removing an item never touches the question, and
 * labels / numbering live on the module, not on the question.
 */

export const DISPLAY_FORMATS: ModuleDisplayFormat[] = ["QUESTION_ONLY", "WITH_OPTIONS", "ANSWER_KEY_END", "SOLUTIONS_SECTION", "SOLUTION_AFTER_EACH"];

export const moduleInclude = {
  sections: {
    orderBy: { order: "asc" },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: {
          question: {
            select: {
              id: true,
              questionCode: true,
              subject: true,
              chapter: true,
              imageUrl: true,
              solution: true,
              translations: { select: { language: true, statement: true, options: true, correctOptionIds: true, solution: true } },
              pyqOccurrences: {
                where: { verificationStatus: "VERIFIED" },
                orderBy: { year: "desc" },
                select: { id: true, year: true, session: true, shift: true, paper: true, exam: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.QuestionModuleInclude;

export type ModuleWithItems = Prisma.QuestionModuleGetPayload<{ include: typeof moduleInclude }>;

export async function getModule(id: string) {
  return prisma.questionModule.findUnique({ where: { id }, include: moduleInclude });
}

async function nextOrder(sectionId: string) {
  const last = await prisma.questionModuleItem.findFirst({ where: { sectionId }, orderBy: { order: "desc" }, select: { order: true } });
  return (last?.order ?? -1) + 1;
}

export async function addSection(moduleId: string, title: string, instructions?: string | null) {
  const last = await prisma.questionModuleSection.findFirst({ where: { moduleId }, orderBy: { order: "desc" }, select: { order: true } });
  return prisma.questionModuleSection.create({ data: { moduleId, title: title.trim() || "Exercise", instructions: instructions?.trim() || null, order: (last?.order ?? -1) + 1 } });
}

/**
 * Adds bank questions to a section, skipping ones already in the module.
 * `prefer` picks which verified occurrence the item is labelled with (the
 * one matching the library filter it was selected under, e.g. NEET UG 2024).
 */
export async function addQuestions(
  moduleId: string,
  sectionId: string,
  questionIds: string[],
  prefer?: { examIds?: string[]; years?: number[] }
) {
  const section = await prisma.questionModuleSection.findFirst({ where: { id: sectionId, moduleId } });
  if (!section) throw new Error("Exercise not found in this module.");
  const already = new Set(
    (await prisma.questionModuleItem.findMany({ where: { section: { moduleId }, questionId: { in: questionIds } }, select: { questionId: true } })).map((r) => r.questionId)
  );
  const fresh = Array.from(new Set(questionIds)).filter((id) => !already.has(id));
  const questions = await prisma.question.findMany({
    where: { id: { in: fresh } },
    select: { id: true, pyqOccurrences: { where: { verificationStatus: "VERIFIED" }, orderBy: { year: "desc" }, select: { id: true, examId: true, year: true } } },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));
  let order = await nextOrder(sectionId);
  const data: Prisma.QuestionModuleItemCreateManyInput[] = [];
  for (const id of fresh) {
    const q = byId.get(id);
    if (!q) continue;
    const occ =
      q.pyqOccurrences.find((o) => (!prefer?.examIds?.length || prefer.examIds.includes(o.examId)) && (!prefer?.years?.length || (o.year !== null && prefer.years.includes(o.year)))) ??
      q.pyqOccurrences[0];
    data.push({ sectionId, order: order++, kind: "QUESTION", questionId: id, occurrenceId: occ?.id ?? null });
  }
  if (data.length) await prisma.questionModuleItem.createMany({ data });
  await prisma.questionModule.update({ where: { id: moduleId }, data: { updatedAt: new Date() } });
  return { added: data.length, skipped: questionIds.length - data.length };
}

export async function addCustomItem(
  moduleId: string,
  sectionId: string,
  kind: "CUSTOM_QUESTION" | "NOTE",
  content: { statement?: string; options?: Record<string, string>; answer?: string; solution?: string; text?: string },
  afterItemId?: string | null
) {
  const section = await prisma.questionModuleSection.findFirst({ where: { id: sectionId, moduleId } });
  if (!section) throw new Error("Exercise not found in this module.");
  let order = await nextOrder(sectionId);
  if (afterItemId) {
    const after = await prisma.questionModuleItem.findFirst({ where: { id: afterItemId, sectionId } });
    if (after) {
      // Make room right after the chosen item.
      await prisma.questionModuleItem.updateMany({ where: { sectionId, order: { gt: after.order } }, data: { order: { increment: 1 } } });
      order = after.order + 1;
    }
  }
  return prisma.questionModuleItem.create({ data: { sectionId, order, kind, content: content as Prisma.InputJsonValue } });
}

/** Rewrites the order of every item; items may move between exercises. */
export async function reorder(moduleId: string, layout: { sectionId: string; itemIds: string[] }[]) {
  const sections = await prisma.questionModuleSection.findMany({ where: { moduleId }, select: { id: true } });
  const allowed = new Set(sections.map((s) => s.id));
  const items = await prisma.questionModuleItem.findMany({ where: { section: { moduleId } }, select: { id: true } });
  const itemSet = new Set(items.map((i) => i.id));
  for (const s of layout) {
    if (!allowed.has(s.sectionId)) throw new Error("Unknown exercise in the new order.");
    for (const id of s.itemIds) if (!itemSet.has(id)) throw new Error("Unknown item in the new order.");
  }
  await prisma.$transaction(
    layout.flatMap((s, si) => [
      prisma.questionModuleSection.update({ where: { id: s.sectionId }, data: { order: si } }),
      ...s.itemIds.map((id, i) => prisma.questionModuleItem.update({ where: { id }, data: { sectionId: s.sectionId, order: i } })),
    ])
  );
}

function optionList(raw: unknown): { key: string; text: string }[] {
  const keys = ["A", "B", "C", "D"];
  if (Array.isArray(raw)) return raw.slice(0, 6).map((o, i) => ({ key: keys[i] ?? String(i + 1), text: typeof o === "string" ? o : String((o as { text?: string })?.text ?? "") }));
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    return keys.filter((k) => r[k] !== undefined).map((k) => ({ key: k, text: String(r[k] ?? "") }));
  }
  return [];
}

function answerOf(raw: unknown): string | null {
  const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  const letters = arr.map((x) => {
    const t = String(x).trim().toUpperCase();
    return /^[1-4]$/.test(t) ? "ABCD"[Number(t) - 1]! : t;
  }).filter((x) => /^[A-D]$/.test(x));
  return letters.length ? letters.join(",") : null;
}

/** Turns a stored module into what the renderer prints. */
export function toRenderModule(m: ModuleWithItems, logoUrl: string | null): RenderModule {
  const settings = (m.settings as { fontSizePt?: number; questionGapMm?: number } | null) ?? {};
  return {
    title: m.title,
    subtitle: m.subtitle,
    subject: m.subject,
    chapter: m.chapter,
    displayFormat: (DISPLAY_FORMATS.includes(m.displayFormat as ModuleDisplayFormat) ? m.displayFormat : "ANSWER_KEY_END") as ModuleDisplayFormat,
    showSourceLabels: m.showSourceLabels,
    pageSize: m.pageSize === "LETTER" || m.pageSize === "A5" ? m.pageSize : "A4",
    coverPage: m.coverPage,
    contentsPage: m.contentsPage,
    fontSizePt: Math.min(14, Math.max(8, Number(settings.fontSizePt) || 11)),
    questionGapMm: Math.min(20, Math.max(1, Number(settings.questionGapMm) || 5)),
    logoUrl,
    sections: m.sections.map((s) => ({
      title: s.title,
      instructions: s.instructions,
      pageBreakBefore: s.pageBreakBefore,
      items: s.items.map((it): RenderItem => {
        const pres = (it.presentation as { labelOverride?: string; pageBreakBefore?: boolean } | null) ?? {};
        if (it.kind === "NOTE") return { kind: "NOTE", text: String((it.content as { text?: string } | null)?.text ?? "") };
        if (it.kind === "CUSTOM_QUESTION") {
          const c = (it.content as { statement?: string; options?: Record<string, string>; answer?: string; solution?: string } | null) ?? {};
          return { kind: "QUESTION", statement: c.statement ?? "", options: optionList(c.options), answer: answerOf(c.answer ?? null), solution: c.solution ?? null, imageUrl: null, sourceLabel: pres.labelOverride ?? null, pageBreakBefore: pres.pageBreakBefore };
        }
        const q = it.question;
        if (!q) return { kind: "QUESTION", statement: "", options: [], answer: null, solution: null, imageUrl: null, sourceLabel: null, missing: true };
        const en = q.translations.find((t) => t.language === "ENGLISH") ?? q.translations[0];
        const occ = q.pyqOccurrences.find((o) => o.id === it.occurrenceId) ?? null;
        return {
          kind: "QUESTION",
          statement: en?.statement ?? "",
          options: optionList(en?.options),
          answer: answerOf(en?.correctOptionIds),
          solution: en?.solution ?? q.solution ?? null,
          imageUrl: q.imageUrl,
          // Only a verified occurrence earns a source label.
          sourceLabel: pres.labelOverride ?? (occ ? formatOccurrenceLabel({ examName: occ.exam.name, year: occ.year, session: occ.session, shift: occ.shift, paper: occ.paper }) : null),
          pageBreakBefore: pres.pageBreakBefore,
        };
      }),
    })),
  };
}
