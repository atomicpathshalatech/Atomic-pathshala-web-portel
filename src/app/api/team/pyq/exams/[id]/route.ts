import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { addExamAlias } from "@/lib/pyq/exams-service";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  addAlias: z.string().trim().min(2).max(80).optional(),
  isActive: z.boolean().optional(),
});

/** PATCH — rename an exam, add an alias ("JEE Mains"), or hide it. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireTeam(PERMISSIONS.QUESTION_IMPORT);
    const body = patchSchema.parse(await request.json());
    if (body.addAlias) await addExamAlias(params.id, body.addAlias);
    const exam = await prisma.pyqExam.update({
      where: { id: params.id },
      data: { ...(body.name ? { name: body.name } : {}), ...(body.isActive !== undefined ? { isActive: body.isActive } : {}) },
    });
    return apiSuccess({ exam });
  } catch (error) {
    return handleApiError(error);
  }
}
