import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FINANCE_READ);

    const rules = await prisma.taxRule.findMany({
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ rules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FINANCE_GST_MANAGE);

    const body = await request.json();
    const {
      name,
      sacHsnCode,
      description,
      cgstRate,
      sgstRate,
      igstRate,
      cessRate,
      isExempt,
      effectiveFrom,
      effectiveUntil,
      isActive,
    } = body;

    if (!name || !sacHsnCode) {
      return handleApiError(new Error("Rule name and SAC/HSN code are required"));
    }

    const rule = await prisma.taxRule.create({
      data: {
        name,
        sacHsnCode,
        description,
        cgstRate: Number(cgstRate ?? 9),
        sgstRate: Number(sgstRate ?? 9),
        igstRate: Number(igstRate ?? 18),
        cessRate: Number(cessRate ?? 0),
        isExempt: Boolean(isExempt),
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return apiSuccess({ rule, message: "Tax Rule created successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
