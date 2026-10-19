import { NextRequest } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { libraryTree } from "@/lib/pyq/library-query";
import { AmbiguousExamError, ensureExam, resolveExamLabel } from "@/lib/pyq/exams-service";

/** GET — exams with year -> question counts (the library tree). */
export async function GET(request: NextRequest) {
  try {
    await requireTeam(PERMISSIONS.QUESTION_READ);
    const v = request.nextUrl.searchParams.get("verification");
    const tree = await libraryTree(v === "UNVERIFIED" || v === "ALL" ? v : "VERIFIED");
    return apiSuccess({ exams: tree });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({ name: z.string().trim().min(2).max(80), checkOnly: z.boolean().optional() });

/**
 * POST { name } — resolve a typed exam name, creating a custom exam when it
 * is new. "JEE" alone is ambiguous: 409 with the candidates to choose from.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireTeam(PERMISSIONS.QUESTION_IMPORT);
    const { name, checkOnly } = createSchema.parse(await request.json());
    if (checkOnly) {
      const res = await resolveExamLabel(name);
      return apiSuccess(res.kind === "match" ? { match: res.exam } : res.kind === "ambiguous" ? { ambiguous: res.candidates } : { isNew: true });
    }
    const exam = await ensureExam(name, userId);
    return apiSuccess({ exam }, 201);
  } catch (error) {
    if (error instanceof AmbiguousExamError) return apiError(error.message, 409, { code: "AMBIGUOUS_EXAM", details: { candidates: error.candidates } });
    return handleApiError(error);
  }
}
