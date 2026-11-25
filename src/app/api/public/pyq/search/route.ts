import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { searchStudentPYQs } from "@/lib/pyq/visibility";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isAuthorized = Boolean(session?.user?.id);

    const sp = request.nextUrl.searchParams;
    const q = sp.get("q")?.trim() || "";
    const examSlug = sp.get("exam")?.trim() || null;
    const subject = sp.get("subject")?.trim() || null;
    const chapter = sp.get("chapter")?.trim() || null;
    const year = sp.get("year") ? parseInt(sp.get("year")!, 10) : null;
    const lang = sp.get("lang")?.trim().toUpperCase() || "ALL";
    const page = Math.max(1, Number(sp.get("page") || 1));
    const pageSize = Math.min(30, Math.max(1, Number(sp.get("pageSize") || 15)));

    const { total, questions } = await searchStudentPYQs(q, {
      examSlug,
      subject,
      chapter,
      year,
      lang,
      page,
      pageSize,
      includeSolution: isAuthorized,
    });

    return apiSuccess({
      total,
      page,
      pageSize,
      isAuthorized,
      questions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
