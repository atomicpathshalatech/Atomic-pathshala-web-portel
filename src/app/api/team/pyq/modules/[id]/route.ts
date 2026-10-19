import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { DISPLAY_FORMATS, getModule, toRenderModule } from "@/lib/pyq/module-service";
import { preflightModule } from "@/lib/pyq/module-html";

/** GET — module with exercises, items (question text, verified source labels) and export warnings. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireTeam(PERMISSIONS.MODULE_READ);
    const qm = await getModule(params.id);
    if (!qm) return apiError("Module not found", 404);
    const exports = await prisma.questionModuleExport.findMany({ where: { moduleId: qm.id }, orderBy: { createdAt: "desc" }, take: 5 });
    return apiSuccess({ module: qm, warnings: preflightModule(toRenderModule(qm, null)), exports });
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  subtitle: z.string().trim().max(200).nullable().optional(),
  subject: z.string().trim().max(40).nullable().optional(),
  chapter: z.string().trim().max(160).nullable().optional(),
  displayFormat: z.enum(DISPLAY_FORMATS as [string, ...string[]]).optional(),
  showSourceLabels: z.boolean().optional(),
  pageSize: z.enum(["A4", "LETTER", "A5"]).optional(),
  coverPage: z.boolean().optional(),
  contentsPage: z.boolean().optional(),
  settings: z.object({ fontSizePt: z.number().min(8).max(14).optional(), questionGapMm: z.number().min(1).max(20).optional() }).optional(),
});

/** PATCH — title and print settings. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireTeam(PERMISSIONS.MODULE_UPDATE);
    const body = schema.parse(await request.json());
    const qm = await prisma.questionModule.update({ where: { id: params.id }, data: body });
    return apiSuccess({ module: qm });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE — removes the module only; its questions stay in the Question Bank / PYQ Library. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireTeam(PERMISSIONS.MODULE_DELETE);
    await prisma.questionModule.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
