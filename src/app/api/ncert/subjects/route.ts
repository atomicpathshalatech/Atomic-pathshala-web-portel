import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { NCERTDocumentStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const classNumeric = searchParams.get("classNumeric");

    let whereClause: any = { isActive: true };

    if (classId) {
      whereClause.classId = classId;
    } else if (classNumeric) {
      const cls = await prisma.academicClass.findUnique({
        where: { numericValue: parseInt(classNumeric, 10) },
      });
      if (cls) {
        whereClause.classId = cls.id;
      }
    }

    const subjects = await prisma.academicSubject.findMany({
      where: whereClause,
      select: {
        id: true,
        classId: true,
        name: true,
        nameHindi: true,
        code: true,
        order: true,
        _count: {
          select: {
            ncertDocuments: {
              where: {
                status: { in: [NCERTDocumentStatus.READY, NCERTDocumentStatus.PUBLISHED] },
              },
            },
          },
        },
      },
      orderBy: { order: "asc" },
    });

    const formatted = subjects.map((s) => ({
      id: s.id,
      name: s.name,
      nameHindi: s.nameHindi,
      code: s.code,
      documentCount: s._count.ncertDocuments,
    }));

    return NextResponse.json({ subjects: formatted });
  } catch (error: any) {
    console.error("[NCERT Subjects API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch subjects" }, { status: 500 });
  }
}
