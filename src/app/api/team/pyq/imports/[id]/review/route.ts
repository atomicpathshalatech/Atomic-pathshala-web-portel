import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { can, requireTeam } from "@/lib/pyq/api";
import { approveExtracted, bulkSetChapter, bulkSetYear, rejectExtracted, resolveDuplicate } from "@/lib/pyq/review-service";

const ids = z.array(z.string()).min(1).max(500);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), ids }),
  z.object({ action: z.literal("approve-ready") }),
  z.object({ action: z.literal("reject"), ids }),
  z.object({ action: z.literal("set-chapter"), ids, subject: z.string().min(2).max(40), chapter: z.string().min(2).max(160), topic: z.string().max(200).nullable().optional() }),
  z.object({ action: z.literal("set-year"), ids, examId: z.string().min(1), year: z.number().int().min(1980).max(2100) }),
  z.object({ action: z.literal("duplicate"), id: z.string(), decision: z.enum(["LINKED", "KEEP_SEPARATE", "IGNORED"]) }),
]);

/**
 * POST review actions for one import. Approving needs question.verify (or
 * question.approve); a reviewer holding question.approve publishes the
 * question straight away (usable in tests/DPPs), anyone else creates a
 * Question Bank draft. The PYQ occurrence is verified either way.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireTeam(PERMISSIONS.QUESTION_IMPORT);
    const body = schema.parse(await request.json());
    const scope = async (list: string[]) =>
      (await prisma.extractedQuestion.findMany({ where: { id: { in: list }, jobId: params.id }, select: { id: true } })).map((r) => r.id);

    if (body.action === "approve" || body.action === "approve-ready") {
      const publish = await can(userId, PERMISSIONS.QUESTION_APPROVE);
      if (!publish && !(await can(userId, PERMISSIONS.QUESTION_VERIFY))) {
        return apiError("You need question verification rights to approve PYQs.", 403);
      }
      // "Bulk approve valid questions": only rows with nothing left to fix.
      const target =
        body.action === "approve"
          ? await scope(body.ids)
          : (
              await prisma.extractedQuestion.findMany({
                where: { jobId: params.id, reviewDecision: "PENDING", status: "EXTRACTED" },
                select: { id: true },
                orderBy: [{ sourcePage: "asc" }, { questionIndex: "asc" }],
                take: 500,
              })
            ).map((r) => r.id);
      const results = await approveExtracted(target, userId, publish);
      const approved = results.filter((r) => r.ok).length;
      await prisma.auditLog.create({
        data: { userId, action: "PYQ_IMPORT_APPROVE", entityType: "ExtractionJob", entityId: params.id, metadata: { requested: target.length, approved, published: publish } },
      });
      return apiSuccess({ results, approved, published: publish });
    }
    if (body.action === "reject") return apiSuccess({ rejected: await rejectExtracted(await scope(body.ids), userId) });
    if (body.action === "set-chapter") {
      return apiSuccess({ updated: await bulkSetChapter(await scope(body.ids), body.subject, body.chapter, body.topic ?? null, userId) });
    }
    if (body.action === "set-year") {
      return apiSuccess({ updated: (await bulkSetYear(await scope(body.ids), body.examId, body.year, userId)).count });
    }
    const [id] = await scope([body.id]);
    if (!id) return apiError("Question not found in this import", 404);
    return apiSuccess({ question: await resolveDuplicate(id, body.decision, userId) });
  } catch (error) {
    if (error instanceof Error && /no duplicate warning|Already reviewed/.test(error.message)) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
