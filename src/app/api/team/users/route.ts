import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS, type PermissionCode } from "@/lib/rbac/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canRead = await hasPermission(session.user.id, PERMISSIONS.USER_READ);
    if (!canRead) {
      return NextResponse.json({ error: "Forbidden: USER_READ permission required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const department = searchParams.get("department") || "";
    const subject = searchParams.get("subject") || "";
    const status = searchParams.get("status") || "";
    const contractType = searchParams.get("contractType") || "";

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { id: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role && role !== "ALL") {
      where.role = { name: role };
    }

    if (department && department !== "ALL") {
      where.department = department;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (contractType && contractType !== "ALL") {
      where.contractType = contractType;
    }

    if (subject && subject !== "ALL") {
      where.OR = [
        { subjectScope: { has: subject } },
        { teacher: { subject: subject } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        role: { select: { id: true, name: true, label: true } },
        teacher: { select: { id: true, subjects: true, department: true } },
        userPermissionOverrides: { select: { id: true, permissionCode: true, granted: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const formatted = users.map((u) => {
      // Determine primary subject
      let primarySubject = u.teacher?.subjects?.[0] || null;
      if (!primarySubject && u.subjectScope && u.subjectScope.length > 0) {
        primarySubject = u.subjectScope.join(", ");
      }

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        photoUrl: u.photoUrl,
        status: u.status,
        role: u.role.name,
        roleLabel: u.role.label,
        department: u.department || u.teacher?.department || (u.teacher ? "Academic" : "Administration"),
        position: u.position || u.role.label,
        subject: primarySubject,
        subjectScope: u.subjectScope,
        batchScope: u.batchScope,
        contractType: u.contractType || "FULL_TIME",
        contractStart: u.contractStart,
        contractEnd: u.contractEnd,
        contractNote: u.contractNote,
        overridesCount: u.userPermissionOverrides.length,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() || null,
      };
    });

    // Compute metrics
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { status: "ACTIVE" } });
    const teachersCount = await prisma.user.count({ where: { role: { name: "TEACHER" } } });
    const contentCount = await prisma.user.count({ where: { role: { name: { in: ["CONTENT_CREATOR", "CONTENT_TEAM"] } } } });
    const smeCount = await prisma.user.count({ where: { role: { name: { in: ["SME", "QUESTION_TEAM"] } } } });
    const salesCount = await prisma.user.count({ where: { role: { name: "SALES" } } });
    const designerCount = await prisma.user.count({ where: { role: { name: "DESIGNER" } } });
    const videoCount = await prisma.user.count({ where: { role: { name: "VIDEO_EDITOR" } } });
    const adminsCount = await prisma.user.count({ where: { role: { name: { in: ["SUPER_ADMIN", "ADMIN", "SUB_ADMIN", "FOUNDER"] } } } });

    return NextResponse.json({
      users: formatted,
      stats: {
        totalUsers,
        activeUsers,
        teachersCount,
        contentCount,
        smeCount,
        salesCount,
        designerCount,
        videoCount,
        adminsCount,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/team/users:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canCreate = await hasPermission(session.user.id, PERMISSIONS.USER_CREATE);
    if (!canCreate) {
      return NextResponse.json({ error: "Forbidden: USER_CREATE permission required" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      email,
      password,
      roleName = "TEACHER",
      department,
      position,
      subject,
      subjectScope = [],
      batchScope = [],
      contractType = "FULL_TIME",
      contractStart,
      contractEnd,
      contractNote,
      phone,
    } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
    }

    // Find role in DB
    let role = await prisma.role.findUnique({ where: { name: roleName as any } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          name: roleName as any,
          label: roleName.replace(/_/g, " "),
          isSystem: true,
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const subjectsArr = subject ? Array.from(new Set([subject, ...subjectScope])) : subjectScope;

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash,
        roleId: role.id,
        department: department || (roleName === "TEACHER" ? "Academic" : "Administration"),
        position: position || (roleName === "TEACHER" ? `${subject || "General"} Faculty` : role.label),
        subjectScope: subjectsArr,
        batchScope: batchScope || [],
        contractType: contractType || "FULL_TIME",
        contractStart: contractStart ? new Date(contractStart) : new Date(),
        contractEnd: contractEnd ? new Date(contractEnd) : null,
        contractNote: contractNote || null,
        status: "ACTIVE",
      },
    });

    // If teacher role, also create Teacher record
    if (roleName === "TEACHER") {
      await prisma.teacher.create({
        data: {
          userId: newUser.id,
          employeeCode: `EMP-${Date.now().toString().slice(-6)}`,
          department: department || "Academic",
          subjects: subjectsArr.length > 0 ? subjectsArr : [subject || "Physics"],
        },
      });
    }

    // Log Audit Entry
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "USER_CREATED",
        entityType: "USER",
        entityId: newUser.id,
        metadata: {
          createdUserName: newUser.name,
          createdUserEmail: newUser.email,
          role: roleName,
          department: newUser.department,
          position: newUser.position,
          subjectScope: subjectsArr,
        },
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: role.name,
        department: newUser.department,
        position: newUser.position,
      },
    });
  } catch (error: any) {
    console.error("Error in POST /api/team/users:", error);
    return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 500 });
  }
}
