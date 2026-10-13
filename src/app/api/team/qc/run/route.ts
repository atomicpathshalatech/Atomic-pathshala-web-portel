import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { runQcForQuestion, type QcRunResult } from "@/lib/qc/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// One request reviews a few questions (each needs three model calls and can
// take a minute or more); the dashboard keeps calling until nothing is left.
const MAX_PER_REQUEST = 3;
// A review still running at this point is reported as not finished, so the
// request answers before the platform's time limit cuts it off.
const TIME_BUDGET_MS = 270_000;

const bodySchema = z.object({
  questionIds: z.array(z.string().min(1)).max(MAX_PER_REQUEST).optional(),
  subject: z.string().trim().min(1).optional(),
  chapter: z.string().trim().min(1).optional(),
  // Which questions a filter run picks up. ERROR lets a failed batch be retried.
  include: z.enum(["UNREVIEWED", "ERROR"]).default("UNREVIEWED"),
  force: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);
    const userId = session.user.id;

    const body = bodySchema.parse(await req.json());

    let ids = body.questionIds ?? [];
    let remaining = 0;
    if (ids.length === 0) {
      const where: Prisma.QuestionWhereInput = {
        ...(body.subject && { subject: body.subject }),
        ...(body.chapter && { chapter: body.chapter }),
        ...(body.include === "ERROR" ? { qcStatus: "ERROR" } : { OR: [{ qcStatus: "UNREVIEWED" }, { qcStatus: null }] }),
      };
      const [count, rows] = await Promise.all([
        prisma.question.count({ where }),
        prisma.question.findMany({ where, orderBy: { createdAt: "asc" }, take: MAX_PER_REQUEST, select: { id: true } }),
      ]);
      ids = rows.map((r) => r.id);
      remaining = Math.max(0, count - ids.length);
    }

    const slow = (id: string) =>
      new Promise<QcRunResult>((resolve) =>
        setTimeout(() => resolve({ questionId: id, status: "ERROR", reused: false, message: "The review took too long (the models are busy or out of quota). Nothing was saved for this question; try again later." }), TIME_BUDGET_MS)
      );
    const settled = await Promise.allSettled(ids.map((id) => Promise.race([runQcForQuestion(id, userId, { force: body.force || body.include === "ERROR" }), slow(id)])));
    const results: QcRunResult[] = settled.map((s, i) =>
      s.status === "fulfilled" ? s.value : { questionId: ids[i]!, status: "ERROR", reused: false, message: String(s.reason instanceof Error ? s.reason.message : s.reason).slice(0, 300) }
    );

    return apiSuccess({ results, remaining });
  } catch (error) {
    return handleApiError(error);
  }
}
