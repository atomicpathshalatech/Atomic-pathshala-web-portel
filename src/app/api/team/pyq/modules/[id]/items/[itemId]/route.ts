import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";

const schema = z.object({
  // Custom question / note text (bank questions are edited in the Question Bank, never here).
  content: z.record(z.unknown()).optional(),
  // Module-only presentation: label override, page break.
  presentation: z.object({ labelOverride: z.string().max(80).nullable().optional(), pageBreakBefore: z.boolean().optional() }).optional(),
  occurrenceId: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  try {
    await requireTeam(PERMISSIONS.MODULE_UPDATE);
    const body = schema.parse(await request.json());
    const item = await prisma.questionModuleItem.findFirst({ where: { id: params.itemId, section: { moduleId: params.id } } });
    if (!item) return apiError("Item not found", 404);
    if (body.content && item.kind === "QUESTION") return apiError("Bank questions are edited in the Question Bank, not in a module.", 400);
    if (body.occurrenceId) {
      const ok = await prisma.pyqOccurrence.findFirst({ where: { id: body.occurrenceId, questionId: item.questionId ?? "", verificationStatus: "VERIFIED" } });
      if (!ok) return apiError("That source label is not a verified occurrence of this question.", 400);
    }
    const updated = await prisma.questionModuleItem.update({
      where: { id: item.id },
      data: {
        ...(body.content ? { content: body.content as Prisma.InputJsonValue } : {}),
        ...(body.presentation ? { presentation: { ...((item.presentation as object | null) ?? {}), ...body.presentation } as Prisma.InputJsonValue } : {}),
        ...(body.occurrenceId !== undefined ? { occurrenceId: body.occurrenceId } : {}),
      },
    });
    return apiSuccess({ item: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE — removes the item from the module only; the question stays in the library. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  try {
    await requireTeam(PERMISSIONS.MODULE_UPDATE);
    const res = await prisma.questionModuleItem.deleteMany({ where: { id: params.itemId, section: { moduleId: params.id } } });
    if (!res.count) return apiError("Item not found", 404);
    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
