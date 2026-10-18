import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { designSchema } from "@/lib/module-studio/design/model";
import { loadDesign, saveDesign, DesignConflictError, designOfModule, listModuleDesigns } from "@/lib/module-studio/design/store";

export const dynamic = "force-dynamic";

/**
 * GET                → this module's design (a new one from the module's details if none is saved)
 * GET ?copyFrom=<id> → another module's design (to duplicate it here)
 * GET ?others=1      → modules that have a design
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);
    const sp = request.nextUrl.searchParams;
    if (sp.get("others")) return apiSuccess({ designs: await listModuleDesigns(params.id) });
    const from = sp.get("copyFrom");
    if (from) {
      const d = await designOfModule(from);
      if (!d) return apiError("That module has no saved design.", 404);
      return apiSuccess({ design: d });
    }
    const r = await loadDesign(params.id);
    if (!r) return apiError("Module not found", 404);
    return apiSuccess(r);
  } catch (error) {
    return handleApiError(error);
  }
}

const putSchema = z.object({ baseRevision: z.number().int().min(0), design: designSchema });

/** PUT { baseRevision, design } → saved; 409 when someone saved a newer version in between. */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_UPDATE);
    const input = putSchema.parse(await request.json());
    if (!(await loadDesign(params.id))) return apiError("Module not found", 404);
    return apiSuccess(await saveDesign(params.id, session.user.id, input.design, input.baseRevision));
  } catch (error) {
    if (error instanceof DesignConflictError) return apiError(error.message, 409, { code: "DESIGN_CHANGED_ELSEWHERE", details: { revision: error.revision } });
    return handleApiError(error);
  }
}
