import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { NCERTDocumentStatus } from "@prisma/client";

export async function GET() {
  try {
    // Return classes that have published or ready NCERT documents, or fallback to Class 11 and 12
    const classesWithDocs = await prisma.academicClass.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        numericValue: true,
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
      orderBy: { numericValue: "asc" },
    });

    const formatted = classesWithDocs.map((c) => ({
      id: c.id,
      name: c.name,
      numericValue: c.numericValue,
      documentCount: c._count.ncertDocuments,
    }));

    return NextResponse.json({ classes: formatted });
  } catch (error: any) {
    console.error("[NCERT Classes API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch classes" }, { status: 500 });
  }
}
