import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";

const schema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  instructions: z.string().max(2000).nullable().optional(),
  pageBreakBefore: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string; sid: string } }) {
  try {
    await requireTeam(PERMISSIONS.MODULE_UPDATE);
    const body = schema.parse(await request.json());
    const res = await prisma.questionModuleSection.updateMany({ where: { id: params.sid, moduleId: params.id }, data: body });
    if (!res.count) return apiError("Exercise not found", 404);
    return apiSuccess({ updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE — removes the exercise and its module items; the questions themselves stay in the bank. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; sid: string } }) {
  try {
    await requireTeam(PERMISSIONS.MODULE_UPDATE);
    const res = await prisma.questionModuleSection.deleteMany({ where: { id: params.sid, moduleId: params.id } });
    if (!res.count) return apiError("Exercise not found", 404);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
