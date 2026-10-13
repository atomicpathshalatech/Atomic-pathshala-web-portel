import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { scanForDuplicates } from "@/lib/qc/duplicate-scan";
import { normalizeAnswerKeys, normalizeOptions } from "@/lib/qc/question";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PAGE_SIZE = 15;

const SIDE = {
  id: true,
  questionCode: true,
  subject: true,
  chapter: true,
  topic: true,
  type: true,
  status: true,
  createdAt: true,
  qcStatus: true,
  translations: { select: { language: true, statement: true, options: true, correctOptionIds: true, solution: true } },
  _count: { select: { sectionLinks: true, dppLinks: true } },
} satisfies Prisma.QuestionSelect;

type Side = Prisma.QuestionGetPayload<{ select: typeof SIDE }>;

function side(q: Side, language: string) {
  const t = q.translations.find((x) => x.language.toUpperCase() === language) ?? q.translations[0];
  return {
    id: q.id,
    questionCode: q.questionCode,
    subject: q.subject,
    chapter: q.chapter,
    topic: q.topic,
    type: q.type,
    status: q.status,
    qcStatus: q.qcStatus ?? "UNREVIEWED",
    createdAt: q.createdAt,
    usedInTests: q._count.sectionLinks,
    usedInDpps: q._count.dppLinks,
    statement: t?.statement ?? "",
    options: normalizeOptions(t?.options),
    answer: normalizeAnswerKeys(t?.correctOptionIds),
    solution: t?.solution ?? null,
  };
}

// The duplicate pairs waiting for (or already given) a decision.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

    const p = req.nextUrl.searchParams;
    const status = p.get("status")?.trim() || "PENDING";
    const category = p.get("category")?.trim();
    const subject = p.get("subject")?.trim();
    const answers = p.get("answers")?.trim();
    const page = Math.max(1, Number(p.get("page")) || 1);

    const where: Prisma.QuestionDuplicateCandidateWhereInput = {
      ...(status !== "ALL" && { status }),
      ...(category && { category }),
      ...(subject && { questionA: { subject } }),
      ...(answers === "different" && { sameAnswer: false }),
    };

    const [total, rows, byCategory, byStatus, differentAnswers] = await Promise.all([
      prisma.questionDuplicateCandidate.count({ where }),
      prisma.questionDuplicateCandidate.findMany({
        where,
        // Pairs whose keys disagree first: one of the two keys is likely wrong.
        orderBy: [{ sameAnswer: { sort: "asc", nulls: "last" } }, { score: "desc" }, { id: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { questionA: { select: SIDE }, questionB: { select: SIDE } },
      }),
      prisma.questionDuplicateCandidate.groupBy({ by: ["category"], where: { status: "PENDING" }, _count: { _all: true } }),
      prisma.questionDuplicateCandidate.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.questionDuplicateCandidate.count({ where: { status: "PENDING", sameAnswer: false } }),
    ]);

    return apiSuccess({
      total,
      page,
      pageSize: PAGE_SIZE,
      pendingByCategory: Object.fromEntries(byCategory.map((c) => [c.category, c._count._all])),
      byStatus: Object.fromEntries(byStatus.map((c) => [c.status, c._count._all])),
      pendingWithDifferentAnswers: differentAnswers,
      items: rows.map((r) => ({
        id: r.id,
        category: r.category,
        score: r.score,
        method: r.method,
        language: r.language,
        sameAnswer: r.sameAnswer,
        note: r.note,
        status: r.status,
        decisionNote: r.decisionNote,
        a: side(r.questionA, r.language),
        b: side(r.questionB, r.language),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const scanSchema = z.object({ subject: z.string().trim().min(1).optional() });

// Runs the duplicate finder (plain text comparison, no model call) and stores the pairs.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

    const body = scanSchema.parse(await req.json().catch(() => ({})));
    return apiSuccess(await scanForDuplicates(body.subject));
  } catch (error) {
    return handleApiError(error);
  }
}
