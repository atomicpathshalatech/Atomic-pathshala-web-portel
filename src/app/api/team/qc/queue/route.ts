import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

// The list behind the QC dashboard: questions by QC status / subject / chapter.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

    const p = req.nextUrl.searchParams;
    const status = p.get("status")?.trim();
    const subject = p.get("subject")?.trim();
    const chapter = p.get("chapter")?.trim();
    const search = p.get("search")?.trim();
    const page = Math.max(1, Number(p.get("page")) || 1);

    const where: Prisma.QuestionWhereInput = {
      ...(status === "UNREVIEWED" ? { OR: [{ qcStatus: "UNREVIEWED" }, { qcStatus: null }] } : status ? { qcStatus: status } : {}),
      ...(subject && { subject }),
      ...(chapter && { chapter }),
      ...(search && { questionCode: { contains: search, mode: "insensitive" as const } }),
    };

    const [total, rows] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        orderBy: [{ qcReviewedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          questionCode: true,
          subject: true,
          chapter: true,
          topic: true,
          type: true,
          status: true,
          qcStatus: true,
          qcReviewedAt: true,
          qcHash: true,
          translations: { select: { language: true, statement: true }, take: 2 },
          _count: { select: { qcCorrections: { where: { status: "PROPOSED" } } } },
        },
      }),
    ]);

    // Findings of the latest review only (older reviews stay in the history).
    const findingRows = await prisma.qcFinding.findMany({ where: { questionId: { in: rows.map((r) => r.id) } }, select: { questionId: true, review: { select: { contentHash: true } } } });
    const hashOf = new Map(rows.map((r) => [r.id, r.qcHash]));
    const findingCount = new Map<string, number>();
    for (const f of findingRows) if (f.review.contentHash === hashOf.get(f.questionId)) findingCount.set(f.questionId, (findingCount.get(f.questionId) ?? 0) + 1);

    return apiSuccess({
      total,
      page,
      pageSize: PAGE_SIZE,
      items: rows.map((q) => {
        const t = q.translations.find((x) => x.language.toUpperCase() === "ENGLISH") ?? q.translations[0];
        return {
          id: q.id,
          questionCode: q.questionCode,
          subject: q.subject,
          chapter: q.chapter,
          topic: q.topic,
          type: q.type,
          status: q.status,
          qcStatus: q.qcStatus ?? "UNREVIEWED",
          qcReviewedAt: q.qcReviewedAt,
          preview: (t?.statement ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180),
          findings: findingCount.get(q.id) ?? 0,
          openCorrections: q._count.qcCorrections,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
