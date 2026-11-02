import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { pyqQuestions } from "@/lib/pyq/student-practice";

export const dynamic = "force-dynamic";

/** One paper (?subject&exam&year) or one chapter (?subject&chapter) — questions without answers. */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const sp = request.nextUrl.searchParams;
    const subject = sp.get("subject")?.trim();
    const chapter = sp.get("chapter")?.trim() || null;
    const examId = sp.get("exam")?.trim() || null;
    const year = Number.parseInt(sp.get("year") || "", 10) || null;
    if (!subject || (!chapter && !(examId && year))) return apiError("Choose a year or a chapter.", 400);
    return apiSuccess({ questions: await pyqQuestions({ subject, chapter, examId, year }) });
  } catch (error) {
    return handleApiError(error);
  }
}
