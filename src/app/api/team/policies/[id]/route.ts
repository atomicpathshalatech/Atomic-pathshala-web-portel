import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  detailedRules: z.string().optional(),
  version: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTRACT_UPDATE);

    const body = await request.json();
    const data = patchSchema.parse(body);

    const policy = await prisma.organizationalPolicy.update({
      where: { id: params.id },
      data: {
        ...(data.title ? { title: data.title } : {}),
        ...(data.description ? { description: data.description } : {}),
        ...(data.detailedRules ? { detailedRules: data.detailedRules } : {}),
        ...(data.version ? { version: data.version } : {}),
        updatedBy: session.user.id,
      },
    });

    return apiSuccess({ policy, message: "Policy updated successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
