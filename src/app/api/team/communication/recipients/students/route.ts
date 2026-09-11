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

/**
 * GET /api/team/communication/recipients/students — Admin-only (spec
 * section 4: the Communication Center's student recipient list). Same
 * shape as /api/team/students but adds the filters this section needs
 * (teacher, DOB range, registration-date range) rather than mixing them
 * into the Student Management endpoint's own contract.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const batchId = searchParams.get("batchId") || "";
    const teacherId = searchParams.get("teacherId") || "";
    const accountStatus = searchParams.get("accountStatus") || ""; // ACTIVE | INACTIVE | ...
    const enrollmentStatus = searchParams.get("enrollmentStatus") || ""; // ACTIVE | DROPPED | ... on BatchEnrollment
    const dobFrom = searchParams.get("dobFrom");
    const dobTo = searchParams.get("dobTo");
    const registeredFrom = searchParams.get("registeredFrom");
    const registeredTo = searchParams.get("registeredTo");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") || "50", 10)));

    const where: Prisma.StudentWhereInput = {};
    const userWhere: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { studentIdCode: { contains: search, mode: "insensitive" } },
      ];
    }
    if (accountStatus) userWhere.status = accountStatus as never;
    if (Object.keys(userWhere).length > 0) where.user = { ...(where.user as object), ...userWhere };

    if (dobFrom || dobTo) {
      where.dob = {
        ...(dobFrom ? { gte: new Date(dobFrom) } : {}),
        ...(dobTo ? { lte: new Date(dobTo) } : {}),
      };
    }
    if (registeredFrom || registeredTo) {
      where.createdAt = {
        ...(registeredFrom ? { gte: new Date(registeredFrom) } : {}),
        ...(registeredTo ? { lte: new Date(registeredTo) } : {}),
      };
    }
    if (batchId || teacherId || enrollmentStatus) {
      where.batchEnrollments = {
        some: {
          ...(batchId ? { batchId } : {}),
          ...(enrollmentStatus ? { status: enrollmentStatus as never } : {}),
          ...(teacherId ? { batch: { teachers: { some: { teacherId } } } } : {}),
        },
      };
    }

    const [total, students, batches, teachers] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        include: {
          user: { select: { name: true, email: true, phone: true, status: true } },
          batchEnrollments: {
            where: { status: "ACTIVE" },
            include: { batch: { select: { id: true, name: true } } },
            take: 3,
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.batch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.teacher.findMany({
        select: { id: true, user: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      }),
    ]);

    return apiSuccess({
      students: students.map((s) => ({
        studentId: s.id,
        userId: s.userId,
        name: s.user.name,
        email: s.user.email,
        phone: s.user.phone,
        studentIdCode: s.studentIdCode,
        dob: s.dob,
        accountStatus: s.user.status,
        registeredAt: s.createdAt,
        batches: s.batchEnrollments.map((e) => e.batch.name),
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      filterOptions: {
        batches,
        teachers: teachers.map((t) => ({ id: t.id, name: t.user.name })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
