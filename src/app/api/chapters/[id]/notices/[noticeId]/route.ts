import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PATCH /api/chapters/[id]/notices/[noticeId] - Update or toggle pin on a notice
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; noticeId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: chapterId, noticeId } = params;
    const body = await request.json();
    const { title, content, category, isPinned } = body;

    const existingNotice = await prisma.chapterNotice.findUnique({
      where: { id: noticeId },
    });

    if (!existingNotice || existingNotice.chapterId !== chapterId) {
      return NextResponse.json({ error: "Notice not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) updateData.content = content.trim();
    if (category !== undefined) updateData.category = category.toUpperCase();
    if (isPinned !== undefined) updateData.isPinned = Boolean(isPinned);

    const updatedNotice = await prisma.chapterNotice.update({
      where: { id: noticeId },
      data: updateData,
    });

    return NextResponse.json({ success: true, notice: updatedNotice });
  } catch (error: any) {
    console.error("Failed to update notice:", error);
    return NextResponse.json(
      { error: "Failed to update notice", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/chapters/[id]/notices/[noticeId] - Delete a notice
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; noticeId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: chapterId, noticeId } = params;

    const existingNotice = await prisma.chapterNotice.findUnique({
      where: { id: noticeId },
    });

    if (!existingNotice || existingNotice.chapterId !== chapterId) {
      return NextResponse.json({ error: "Notice not found" }, { status: 404 });
    }

    await prisma.chapterNotice.delete({
      where: { id: noticeId },
    });

    return NextResponse.json({ success: true, message: "Notice deleted" });
  } catch (error: any) {
    console.error("Failed to delete notice:", error);
    return NextResponse.json(
      { error: "Failed to delete notice", details: error.message },
      { status: 500 }
    );
  }
}
