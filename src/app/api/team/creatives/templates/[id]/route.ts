import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

const schema = z.object({ isActive: z.boolean().optional(), isDefault: z.boolean().optional(), name: z.string().trim().min(2).optional() });

/** PATCH — activate/deactivate, set default, rename (spec section 4/16). Structural editing (positions, fonts) is done by duplicating + editing layoutConfig via a future template editor; this covers the "Choose Template" admin workflow (spec section 27) without exposing a pixel editor. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const existing = await prisma.creativeTemplate.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Template not found.", 404);

    const input = schema.parse(await req.json());

    if (input.isDefault) {
      // Only one default per type.
      await prisma.creativeTemplate.updateMany({ where: { type: existing.type, isDefault: true }, data: { isDefault: false } });
    }

    const template = await prisma.creativeTemplate.update({ where: { id: params.id }, data: input });
    return apiSuccess({ template });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST ?action=duplicate — spec section 16 "Duplicate template". */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const existing = await prisma.creativeTemplate.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Template not found.", 404);

    let key = `${existing.key}_copy`;
    let n = 1;
    while (await prisma.creativeTemplate.findUnique({ where: { key } })) {
      n++;
      key = `${existing.key}_copy${n}`;
    }
    const copy = await prisma.creativeTemplate.create({
      data: {
        key,
        name: `${existing.name} (Copy)`,
        type: existing.type,
        layoutConfig: existing.layoutConfig as object,
        isActive: false,
        isDefault: false,
      },
    });
    return apiSuccess({ template: copy }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
