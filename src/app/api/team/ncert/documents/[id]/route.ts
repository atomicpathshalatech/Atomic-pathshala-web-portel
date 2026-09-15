import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteR2Object } from "@/lib/storage/r2-client";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
    }

    const doc = await prisma.ncertDocument.findUnique({
      where: { id },
      include: {
        pages: {
          select: { id: true, pageImageUrl: true },
        },
      },
    });

    if (!doc) {
      return NextResponse.json({ error: "Chapter document not found" }, { status: 404 });
    }

    // Try deleting R2 file if it's stored in R2
    if (doc.fileUrl) {
      try {
        await deleteR2Object(doc.fileUrl);
      } catch (r2Err) {
        console.warn("[NCERT Delete] Warning deleting main document R2 file:", r2Err);
      }
    }

    // Try deleting any stored page images in R2
    for (const page of doc.pages) {
      if (page.pageImageUrl && !page.pageImageUrl.startsWith("http")) {
        try {
          await deleteR2Object(page.pageImageUrl);
        } catch (r2Err) {
          console.warn("[NCERT Delete] Warning deleting page image in R2:", r2Err);
        }
      }
    }

    // Transaction to safely clean up all database relations
    await prisma.$transaction(async (tx) => {
      // 1. Delete questions linked to this document
      await tx.ncertPageQuestion.deleteMany({
        where: { documentId: id },
      });

      // 2. Delete student page progress attempts & page progress
      const pageIds = doc.pages.map((p) => p.id);
      if (pageIds.length > 0) {
        await tx.ncertStudentAttempt.deleteMany({
          where: { pageId: { in: pageIds } },
        });
        await tx.ncertStudentPageProgress.deleteMany({
          where: { pageId: { in: pageIds } },
        });
      }

      // 3. Delete student chapter progress
      await tx.ncertStudentChapterProgress.deleteMany({
        where: { documentId: id },
      });

      // 4. Delete pages
      await tx.ncertPage.deleteMany({
        where: { documentId: id },
      });

      // 5. Delete document itself
      await tx.ncertDocument.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      message: "NCERT Chapter document and all related pages deleted successfully",
    });
  } catch (error: any) {
    console.error("[Team NCERT Document DELETE API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete chapter document" },
      { status: 500 }
    );
  }
}
