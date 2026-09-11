import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { generateEnrollmentNumber, generateUniqueStudentIdCode } from "@/lib/utils/id-generator";
import { generateTempPassword, sendCredentialsEmail } from "@/lib/email/credentials";
import { getLoginUrl } from "@/lib/email/app-url";
import { notifyEnrollment } from "@/lib/email/enrollment";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const canRead =
      (await hasPermission(session.user.id, PERMISSIONS.STUDENT_READ_ANY)) ||
      (await hasPermission(session.user.id, PERMISSIONS.USER_READ));
    if (!canRead) {
      return apiError("Forbidden: Insufficient permissions to view student directory", 403);
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const classFilter = searchParams.get("class") || "";
    const targetExam = searchParams.get("targetExam") || "";
    const batchId = searchParams.get("batchId") || "";
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "50", 10)));

    const where: any = {};

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { phone: { contains: search, mode: "insensitive" } } },
        { enrollmentNumber: { contains: search, mode: "insensitive" } },
        { studentIdCode: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { state: { contains: search, mode: "insensitive" } },
      ];
    }

    if (classFilter && classFilter !== "ALL") {
      where.class = classFilter;
    }

    if (targetExam && targetExam !== "ALL") {
      where.targetExam = targetExam;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (batchId && batchId !== "ALL") {
      where.batchEnrollments = {
        some: {
          batchId,
          status: "ACTIVE",
        },
      };
    }

    const [total, rawStudents, totalActive, totalNeet, totalJee, allBatches] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              photoUrl: true,
              status: true,
              createdAt: true,
            },
          },
          batchEnrollments: {
            where: { status: "ACTIVE" },
            include: {
              batch: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  targetExam: true,
                  status: true,
                },
              },
            },
          },
          subscription: {
            select: {
              id: true,
              plan: true,
              status: true,
              currentPeriodEnd: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.student.count({ where: { status: "ACTIVE" } }),
      prisma.student.count({ where: { targetExam: { contains: "NEET", mode: "insensitive" } } }),
      prisma.student.count({ where: { targetExam: { contains: "JEE", mode: "insensitive" } } }),
      prisma.batch.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, code: true, targetExam: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const formatted = rawStudents.map((s) => ({
      id: s.id,
      userId: s.user.id,
      name: s.user.name,
      email: s.user.email,
      phone: s.user.phone || s.emergencyContact,
      photoUrl: s.user.photoUrl,
      enrollmentNumber: s.enrollmentNumber,
      studentIdCode: s.studentIdCode,
      class: s.class,
      targetExam: s.targetExam,
      fatherName: s.fatherName,
      motherName: s.motherName,
      city: s.city,
      state: s.state,
      academicStatus: s.status,
      userStatus: s.user.status,
      xp: s.xp,
      level: s.level,
      enrolledBatches: s.batchEnrollments.map((be) => ({
        enrollmentId: be.id,
        batchId: be.batch.id,
        batchTitle: be.batch.name,
        code: be.batch.code,
        targetExam: be.batch.targetExam,
        enrolledAt: be.enrolledAt,
      })),
      subscription: s.subscription,
      createdAt: s.createdAt.toISOString(),
    }));

    return apiSuccess({
      students: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalStudents: total,
        activeStudents: totalActive,
        neetStudents: totalNeet,
        jeeStudents: totalJee,
      },
      availableBatches: allBatches.map((b) => ({
        id: b.id,
        title: b.name,
        grade: b.code,
        targetExam: b.targetExam || "All Exams",
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const canCreate =
      (await hasPermission(session.user.id, PERMISSIONS.STUDENT_CREATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.USER_CREATE));
    if (!canCreate) {
      return apiError("Forbidden: STUDENT_CREATE permission required", 403);
    }

    const body = await req.json();
    const {
      name,
      email,
      password,
      phone,
      targetClass = "Class 11",
      targetExam = "NEET",
      fatherName = "Parent",
      motherName = "Parent",
      city = "Delhi",
      state = "Delhi",
      gender = "OTHER",
      dob = "2007-01-01",
      batchId,
    } = body;

    if (!name || !email) {
      return apiError("Name and email are required", 400);
    }
    // Admin can still set a specific password (unchanged, existing
    // behaviour); if they leave it blank, we generate one and email it —
    // see the "Registration -> Credential Email" requirement.
    const effectivePassword: string = password || generateTempPassword();

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return apiError("An account with this email already exists", 409);
    }

    let studentRole = await prisma.role.findUnique({ where: { name: "STUDENT" } });
    if (!studentRole) {
      studentRole = await prisma.role.create({
        data: {
          name: "STUDENT",
          label: "Student",
          description: "Enrolled Student Account",
          isSystem: true,
        },
      });
    }

    const hashedPassword = await bcrypt.hash(effectivePassword, 10);
    const enrollmentNumber = generateEnrollmentNumber();
    const studentIdCode = await generateUniqueStudentIdCode(prisma);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          passwordHash: hashedPassword,
          phone: phone || null,
          roleId: studentRole.id,
          status: "ACTIVE",
        },
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          enrollmentNumber,
          studentIdCode,
          fatherName,
          motherName,
          dob: new Date(dob),
          gender: gender === "MALE" ? "MALE" : gender === "FEMALE" ? "FEMALE" : "OTHER",
          class: targetClass,
          targetExam,
          school: "Atomic Pathshala",
          city,
          state,
          status: "ACTIVE",
        },
      });

      let enrollment: { id: string; batch: { name: string } } | null = null;
      if (batchId) {
        enrollment = await tx.batchEnrollment.create({
          data: {
            batchId,
            studentId: student.id,
            status: "ACTIVE",
            enrolledById: session.user.id,
          },
          select: { id: true, batch: { select: { name: true } } },
        });
      }

      return { user, student, enrollment };
    });

    // Fire only after the account is durably created — never lets an email
    // provider hiccup roll back or fail the registration itself (dispatchEmail
    // already never throws; idempotencyKey means a client retry of this
    // same request can't double-send).
    const mail = await sendCredentialsEmail({
      idempotencyKey: `registration:${result.user.id}`,
      recipientUserId: result.user.id,
      recipientType: "STUDENT",
      fullName: result.user.name,
      email: result.user.email,
      password: effectivePassword,
      loginUrl: getLoginUrl(),
    });

    if (result.enrollment) {
      await notifyEnrollment({
        idempotencyKey: `enrollment:${result.enrollment.id}`,
        kind: "BATCH",
        studentUserId: result.user.id,
        studentName: result.user.name,
        studentEmail: result.user.email,
        productName: result.enrollment.batch.name,
      });
    }

    return apiSuccess({
      studentId: result.student.id,
      userId: result.user.id,
      enrollmentNumber: result.student.enrollmentNumber,
      name: result.user.name,
      email: result.user.email,
      credentialsEmailed: mail.outcome === "sent",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
