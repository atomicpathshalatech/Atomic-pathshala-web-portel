import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/team/communication/recipients/staff — Admin-only (spec section 5: separate Staff/Team recipient list, kept distinct from Students). */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const roleName = searchParams.get("roleName") || "";
    const accountStatus = searchParams.get("accountStatus") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") || "50", 10)));

    const where: Prisma.UserWhereInput = {
      role: { name: { notIn: ["STUDENT", "PARENT"] } },
    };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (roleName) where.role = { name: roleName as never };
    if (accountStatus) where.status = accountStatus as never;

    const [total, staff, roles] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          department: true,
          createdAt: true,
          role: { select: { name: true, label: true } },
          teacher: { select: { id: true, employeeCode: true, dob: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.role.findMany({
        where: { name: { notIn: ["STUDENT", "PARENT"] } },
        select: { name: true, label: true },
        orderBy: { label: "asc" },
      }),
    ]);

    return apiSuccess({
      staff: staff.map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        staffId: u.teacher?.employeeCode ?? null,
        roleName: u.role?.name ?? null,
        roleLabel: u.role?.label ?? "No role",
        department: u.department,
        accountStatus: u.status,
        dob: u.teacher?.dob ?? null,
        joinedAt: u.createdAt,
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      filterOptions: { roles },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
