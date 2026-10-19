import { NextRequest } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { addCustomItem, addQuestions, reorder } from "@/lib/pyq/module-service";
import { allMatchingIds, parseLibraryFilters } from "@/lib/pyq/library-query";

const opt = z.string().max(4000);
const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("QUESTIONS"),
    sectionId: z.string(),
    // Either explicit ids, or the library query string to add every match.
    questionIds: z.array(z.string()).max(2000).optional(),
    filterQuery: z.string().max(4000).optional(),
  }),
  z.object({
    kind: z.literal("CUSTOM_QUESTION"),
    sectionId: z.string(),
    afterItemId: z.string().nullable().optional(),
    content: z.object({ statement: z.string().min(1).max(20_000), options: z.object({ A: opt, B: opt, C: opt, D: opt }).optional(), answer: z.string().max(10).optional(), solution: z.string().max(40_000).optional() }),
  }),
  z.object({ kind: z.literal("NOTE"), sectionId: z.string(), afterItemId: z.string().nullable().optional(), content: z.object({ text: z.string().min(1).max(5000) }) }),
]);

/** POST — add library questions (selected, or all matching a filter), a custom question, or a note. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireTeam(PERMISSIONS.MODULE_UPDATE);
    const body = schema.parse(await request.json());
    if (body.kind === "QUESTIONS") {
      let ids = body.questionIds ?? [];
      let prefer: { examIds?: string[]; years?: number[] } | undefined;
      if (body.filterQuery !== undefined) {
        // The filter decides which verified occurrence labels each item
        // ("NEET UG 2024"); with no explicit ids it also picks the questions.
        const filters = parseLibraryFilters(new URLSearchParams(body.filterQuery));
        prefer = { examIds: filters.examIds, years: filters.years };
        if (!ids.length) {
          const all = await allMatchingIds(filters);
          if (all.capped) return apiError(`${all.total} questions match — narrow the filter to 2000 or fewer.`, 400);
          ids = all.ids;
        }
      }
      if (!ids.length) return apiError("No questions to add.", 400);
      return apiSuccess(await addQuestions(params.id, body.sectionId, ids, prefer));
    }
    const item = await addCustomItem(params.id, body.sectionId, body.kind, body.content, body.afterItemId ?? null);
    return apiSuccess({ item }, 201);
  } catch (error) {
    if (error instanceof Error && /not found in this module/.test(error.message)) return apiError(error.message, 404);
    return handleApiError(error);
  }
}

const reorderSchema = z.object({ layout: z.array(z.object({ sectionId: z.string(), itemIds: z.array(z.string()) })).min(1) });

/** PUT — the full order: exercises in order, each with its items in order (items may move between exercises). */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireTeam(PERMISSIONS.MODULE_UPDATE);
    const { layout } = reorderSchema.parse(await request.json());
    await reorder(params.id, layout);
    return apiSuccess({ reordered: true });
  } catch (error) {
    if (error instanceof Error && /Unknown/.test(error.message)) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
