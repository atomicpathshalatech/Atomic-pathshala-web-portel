import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { loadEditorProject, saveEditorProject, ProjectConflictError } from "@/lib/module-editor/project-store";

export const dynamic = "force-dynamic";

const projectSchema = z
  .object({
    textEdits: z.array(z.any()),
    whiteouts: z.array(z.any()),
    images: z.array(z.any()),
    shapes: z.array(z.any()),
    pageOrder: z.array(z.number().int().positive()),
    deletedPages: z.array(z.number().int().positive()),
  })
  .passthrough();
const putSchema = z.object({ baseRevision: z.number().int().min(0), project: projectSchema });

/** GET → the PDF editor's working copy (or its latest saved version) for this module. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);
    return apiSuccess(await loadEditorProject(params.id));
  } catch (error) {
    return handleApiError(error);
  }
}

/** PUT { baseRevision, project } → saves the working copy; 409 if someone saved a newer one in between. */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_UPDATE);
    if (!(await prisma.module.count({ where: { id: params.id } }))) return apiError("Module not found", 404);
    const input = putSchema.parse(await request.json());
    return apiSuccess(await saveEditorProject(params.id, session.user.id, input.project, input.baseRevision));
  } catch (error) {
    if (error instanceof ProjectConflictError) {
      return apiError(error.message, 409, { code: "PROJECT_CHANGED_ELSEWHERE", details: { revision: error.revision, savedAt: error.savedAt } });
    }
    return handleApiError(error);
  }
}
