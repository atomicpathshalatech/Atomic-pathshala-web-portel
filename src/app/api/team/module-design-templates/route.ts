import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { designSchema } from "@/lib/module-studio/design/model";
import { listTemplates, createTemplate, getTemplate, deleteTemplate, designToTemplateData, TemplatesUnavailableError } from "@/lib/module-studio/design/store";

export const dynamic = "force-dynamic";

const unavailable = (e: unknown) => (e instanceof TemplatesUnavailableError ? apiError(e.message, 503, { code: "TEMPLATES_NEED_MIGRATION" }) : null);

/** GET → saved design templates; GET ?id= → one template with its data. */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const t = await getTemplate(id);
      if (!t) return apiError("Template not found", 404);
      return apiSuccess({ template: t });
    }
    const rows = await listTemplates();
    return apiSuccess({ templates: rows.map(({ data, ...r }) => ({ ...r, themeName: (data as any)?.theme?.name ?? null, sections: ((data as any)?.sections ?? []).length })) });
  } catch (error) {
    return unavailable(error) ?? handleApiError(error);
  }
}

const createSchema = z.object({ name: z.string().trim().min(2).max(80), description: z.string().max(300).optional(), design: designSchema });

/** POST { name, description?, design } → saves the design's look as a reusable template. */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_UPDATE);
    const input = createSchema.parse(await request.json());
    return apiSuccess({ template: await createTemplate({ name: input.name, description: input.description, data: designToTemplateData(input.design), userId: session.user.id }) }, 201);
  } catch (error) {
    return unavailable(error) ?? handleApiError(error);
  }
}

/** DELETE ?id= */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_UPDATE);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return apiError("id required", 400);
    await deleteTemplate(id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return unavailable(error) ?? handleApiError(error);
  }
}
