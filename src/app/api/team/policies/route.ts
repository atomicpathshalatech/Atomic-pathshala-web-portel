import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getActiveOrganizationalPolicies } from "@/lib/agreements/policies";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    const policies = await getActiveOrganizationalPolicies();
    return apiSuccess({ policies });
  } catch (error) {
    return handleApiError(error);
  }
}

const updateSchema = z.object({
  policyCode: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  detailedRules: z.string().min(1),
  version: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTRACT_UPDATE);

    const body = await request.json();
    const data = updateSchema.parse(body);

    const updated = await prisma.organizationalPolicy.upsert({
      where: { policyCode: data.policyCode },
      update: {
        title: data.title,
        description: data.description,
        detailedRules: data.detailedRules,
        version: data.version || "1.1",
        updatedBy: session.user.id,
      },
      create: {
        policyCode: data.policyCode,
        title: data.title,
        description: data.description,
        detailedRules: data.detailedRules,
        version: data.version || "1.0",
        updatedBy: session.user.id,
      },
    });

    return apiSuccess({ policy: updated, message: "Policy updated successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
