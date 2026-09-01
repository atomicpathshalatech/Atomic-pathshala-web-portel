import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ProgramName } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'en';
    const isHindi = lang === 'hi';

    const mappings = await prisma.programMapping.findMany({
      where: {
        programName: ProgramName.NEET,
        isActive: true,
      },
      include: {
        class: true,
        subject: true,
        chapter: {
          include: {
            book: true,
            topics: {
              where: { isActive: true },
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
      },
      orderBy: [
        { class: { numericValue: 'asc' } },
        { subject: { order: 'asc' } },
        { chapter: { chapterNumber: 'asc' } },
      ],
    });

    const tree: any = {};

    for (const m of mappings) {
      const className = m.class.name;
      const subjectName = isHindi && m.subject.nameHindi ? m.subject.nameHindi : m.subject.name;

      if (!tree[className]) { tree[className] = {}; }
      if (!tree[className][subjectName]) { tree[className][subjectName] = []; }

      tree[className][subjectName].push({
        chapterId: m.chapter.id,
        chapterNumber: m.chapter.chapterNumber,
        title: isHindi && m.chapter.titleHindi ? m.chapter.titleHindi : m.chapter.title,
        bookPart: m.chapter.book ? m.chapter.book.partNumber : null,
        topicCount: m.chapter.topics.length,
        topics: m.chapter.topics.map((t) => ({
          topicId: t.id,
          topicNumber: t.topicNumber,
          title: isHindi && t.titleHindi ? t.titleHindi : t.title,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      program: 'NEET',
      totalChapters: mappings.length,
      data: tree,
    });
  } catch (error: any) {
    console.error('Error in NEET Mapping API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch NEET mapping' },
      { status: 500 }
    );
  }
}