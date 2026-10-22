import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveStudentForTest } from "@/lib/test-series/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { finalizeReattempt, reattemptAnswers, reattemptDeadlineMs } from "@/lib/test-engine/reattempts";

const submitSchema = z.object({ answers: z.record(z.string().min(1), z.string().min(1).max(20).nullable()).optional() });
const SUBMIT_GRACE_MS = 2 * 60_000;

/** Submits re-attempt n: the answers on screen are taken as final, then it is graded. */
export async function POST(request: NextRequest, { params }: { params: { id: string; n: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const test = await prisma.test.findUnique({ where: { id: params.id } });
    if (!test) return apiError("Test not found", 404);
    const { student } = await resolveStudentForTest(session.user.id, test);
    if (!student) throw new ForbiddenError();

    const re = await prisma.testReattempt.findUnique({
      where: { testId_studentId_attemptNumber: { testId: test.id, studentId: student.id, attemptNumber: Number(params.n) || 0 } },
    });
    if (!re) return apiError("Re-attempt not found.", 404);
    if (re.status !== "IN_PROGRESS") return apiSuccess({ attempt: re });

    const deadlineMs = reattemptDeadlineMs(re.startedAt, test.durationMin);
    const isLate = Date.now() > deadlineMs;
    const body = submitSchema.safeParse(await request.json().catch(() => ({})));
    const sent = body.success ? body.data.answers : undefined;
    if (sent && Date.now() <= deadlineMs + SUBMIT_GRACE_MS) {
      const inTest = await prisma.sectionQuestion.findMany({ where: { section: { testId: test.id } }, select: { questionId: true } });
      const valid = new Set(inTest.map((q) => q.questionId));
      const answers = reattemptAnswers(re.answers);
      for (const [qid, value] of Object.entries(sent)) {
        if (!valid.has(qid)) continue;
        if (value === null) delete answers[qid];
        else answers[qid] = value;
      }
      await prisma.testReattempt.update({ where: { id: re.id }, data: { answers } });
    }

    const finalized = await finalizeReattempt(re.id, isLate);
    return apiSuccess({ attempt: finalized });
  } catch (error) {
    return handleApiError(error);
  }
}
