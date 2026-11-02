import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { checkPyqAnswers } from "@/lib/pyq/student-practice";

export const dynamic = "force-dynamic";

const schema = z.object({
  answers: z.array(z.object({ questionId: z.string().min(1), selected: z.array(z.string()).max(10) })).max(200),
});

/** Submit: right / wrong per question, the right answer and the solution. */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const { answers } = schema.parse(await request.json());
    return apiSuccess({ results: await checkPyqAnswers(answers) });
  } catch (error) {
    return handleApiError(error);
  }
}
