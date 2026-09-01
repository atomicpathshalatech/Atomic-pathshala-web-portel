import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const DEFAULT_DEPARTMENTS_POSITIONS = [
  // Administration
  { department: "Administration", position: "Super Admin", defaultRole: "SUPER_ADMIN" },
  { department: "Administration", position: "Operations Manager", defaultRole: "ADMIN" },
  { department: "Administration", position: "Academic Coordinator", defaultRole: "ADMIN" },

  // Academic
  { department: "Academic", position: "Physics Faculty", defaultRole: "TEACHER" },
  { department: "Academic", position: "Chemistry Faculty", defaultRole: "TEACHER" },
  { department: "Academic", position: "Biology Faculty", defaultRole: "TEACHER" },
  { department: "Academic", position: "Mathematics Faculty", defaultRole: "TEACHER" },
  { department: "Academic", position: "Senior Physics Faculty", defaultRole: "TEACHER" },
  { department: "Academic", position: "Senior Chemistry Faculty", defaultRole: "TEACHER" },
  { department: "Academic", position: "Subject Matter Expert (SME)", defaultRole: "SME" },
  { department: "Academic", position: "Academic Reviewer", defaultRole: "SME" },

  // Content
  { department: "Content", position: "Senior Content Creator", defaultRole: "CONTENT_CREATOR" },
  { department: "Content", position: "Question Creator", defaultRole: "CONTENT_CREATOR" },
  { department: "Content", position: "NEET Biology Content Creator", defaultRole: "CONTENT_CREATOR" },
  { department: "Content", position: "JEE Physics Content Creator", defaultRole: "CONTENT_CREATOR" },
  { department: "Content", position: "Content Reviewer", defaultRole: "CONTENT_CREATOR" },

  // Sales
  { department: "Sales", position: "Sales Executive", defaultRole: "SALES" },
  { department: "Sales", position: "Senior Sales Executive", defaultRole: "SALES" },
  { department: "Sales", position: "Sales Manager", defaultRole: "SALES" },
  { department: "Sales", position: "Admission Counselor", defaultRole: "SALES" },

  // Design
  { department: "Design", position: "Graphic Designer", defaultRole: "DESIGNER" },
  { department: "Design", position: "UI Designer", defaultRole: "DESIGNER" },
  { department: "Design", position: "Thumbnail Designer", defaultRole: "DESIGNER" },
  { department: "Design", position: "Creative Designer", defaultRole: "DESIGNER" },

  // Video Production
  { department: "Video Production", position: "Video Editor", defaultRole: "VIDEO_EDITOR" },
  { department: "Video Production", position: "Senior Video Editor", defaultRole: "VIDEO_EDITOR" },
  { department: "Video Production", position: "Motion Graphics Designer", defaultRole: "VIDEO_EDITOR" },
  { department: "Video Production", position: "Video Producer", defaultRole: "VIDEO_EDITOR" },

  // Operations & Support
  { department: "Operations", position: "Operations Associate", defaultRole: "ADMIN" },
  { department: "Support", position: "Student Support Executive", defaultRole: "SUPPORT" },
];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let items = await prisma.departmentPosition.findMany({
      where: { isActive: true },
      orderBy: [{ department: "asc" }, { position: "asc" }],
    });

    // Seed defaults if empty
    if (items.length === 0) {
      for (const def of DEFAULT_DEPARTMENTS_POSITIONS) {
        await prisma.departmentPosition.create({
          data: def,
        });
      }
      items = await prisma.departmentPosition.findMany({
        where: { isActive: true },
        orderBy: [{ department: "asc" }, { position: "asc" }],
      });
    }

    // Group by department
    const grouped: Record<string, typeof items> = {};
    items.forEach((item) => {
      if (!grouped[item.department]) {
        grouped[item.department] = [];
      }
      grouped[item.department]!.push(item);
    });

    const departments = Object.keys(grouped);

    return NextResponse.json({
      departments,
      positions: items,
      grouped,
      contractTypes: [
        { value: "FULL_TIME", label: "Full Time" },
        { value: "PART_TIME", label: "Part Time" },
        { value: "CONTRACT", label: "Contract" },
        { value: "FREELANCER", label: "Freelancer" },
        { value: "CONSULTANT", label: "Consultant" },
        { value: "INTERNSHIP", label: "Internship" },
        { value: "TEMPORARY", label: "Temporary" },
      ],
    });
  } catch (error: any) {
    console.error("Error in GET /api/team/departments:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch departments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canManage = await hasPermission(session.user.id, PERMISSIONS.DEPARTMENT_MANAGE);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { department, position, defaultRole, description } = body;

    if (!department || !position || !defaultRole) {
      return NextResponse.json({ error: "Department, position, and default role are required" }, { status: 400 });
    }

    const item = await prisma.departmentPosition.upsert({
      where: {
        department_position: {
          department,
          position,
        },
      },
      create: {
        department,
        position,
        defaultRole,
        description: description || null,
        isActive: true,
      },
      update: {
        defaultRole,
        description: description || null,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error("Error in POST /api/team/departments:", error);
    return NextResponse.json({ error: error.message || "Failed to create position" }, { status: 500 });
  }
}
