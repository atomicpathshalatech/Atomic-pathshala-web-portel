import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CustomTopicSchema } from '@/lib/validation/academic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CustomTopicSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
    }

    const { chapterId, topicNumber, title, titleHindi } = parsed.data;

    const chapterRecord = await prisma.academicChapter.findUnique({
      where: { id: chapterId },
    });
    if (!chapterRecord) {
      return NextResponse.json({ success: false, error: 'Invalid Chapter ID' }, { status: 400 });
    }

    const existing = await prisma.academicTopic.findFirst({
      where: {
        chapterId,
        OR: [
          { title: { equals: title, mode: 'insensitive' } },
          { topicNumber: { equals: topicNumber, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Topic "${existing.topicNumber} ${existing.title}" already exists in this chapter` },
        { status: 409 }
      );
    }

    const lastTopic = await prisma.academicTopic.findFirst({
      where: { chapterId },
      orderBy: { displayOrder: 'desc' },
    });
    const displayOrder = (lastTopic?.displayOrder || 0) + 1;

    const topic = await prisma.academicTopic.create({
      data: {
        chapterId,
        topicNumber,
        title,
        titleHindi: titleHindi || null,
        displayOrder,
        isSystem: false,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, data: topic }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating custom topic:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create custom topic' },
      { status: 500 }
    );
  }
}