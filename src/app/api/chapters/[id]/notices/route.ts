import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/chapters/[id]/notices - Fetch all notices for a chapter
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const chapterId = params.id;

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, title: true },
    });

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const notices = await prisma.chapterNotice.findMany({
      where: { chapterId },
      orderBy: [
        { isPinned: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ success: true, notices });
  } catch (error: any) {
    console.error("Failed to fetch chapter notices:", error);
    return NextResponse.json(
      { error: "Failed to fetch notices", details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/chapters/[id]/notices - Create a new notice for a chapter
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chapterId = params.id;
    const body = await request.json();
    const { title, content, category = "ANNOUNCEMENT", isPinned = false, authorName } = body;

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, title: true },
    });

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, role: { select: { name: true } } },
    });

    const finalAuthorName = authorName?.trim() || user?.name || "Senior Subject Faculty";
    const authorRole = (user?.role?.name as string) || "TEACHER";

    const notice = await prisma.chapterNotice.create({
      data: {
        chapterId,
        title: title.trim(),
        content: content.trim(),
        category: category.toUpperCase(),
        isPinned: Boolean(isPinned),
        authorName: finalAuthorName,
        authorRole,
        createdById: session.user.id,
      },
    });

    return NextResponse.json({ success: true, notice }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create chapter notice:", error);
    return NextResponse.json(
      { error: "Failed to create notice", details: error.message },
      { status: 500 }
    );
  }
}
