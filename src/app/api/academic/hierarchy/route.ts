import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AcademicHierarchyQuerySchema } from '@/lib/validation/academic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = AcademicHierarchyQuerySchema.safeParse({
      classId: searchParams.get('classId') || undefined,
      subjectId: searchParams.get('subjectId') || undefined,
      chapterId: searchParams.get('chapterId') || undefined,
      program: searchParams.get('program') || undefined,
      lang: searchParams.get('lang') || 'en',
    });

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
    }

    const { classId, subjectId, chapterId, program, lang } = parsed.data;
    const isHindi = lang === 'hi';

    // 1. Fetch Topics if chapterId is provided
    if (chapterId) {
      const topics = await prisma.academicTopic.findMany({
        where: { chapterId, isActive: true },
        orderBy: { displayOrder: 'asc' },
        include: {
          subtopics: {
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: topics.map((t) => ({
          id: t.id,
          topicNumber: t.topicNumber,
          title: isHindi && t.titleHindi ? t.titleHindi : t.title,
          titleEng: t.title,
          titleHindi: t.titleHindi,
          displayOrder: t.displayOrder,
          isSystem: t.isSystem,
          subtopics: t.subtopics.map((s) => ({
            id: s.id,
            subtopicNumber: s.subtopicNumber,
            title: isHindi && s.titleHindi ? s.titleHindi : s.title,
          })),
        })),
      });
    }

    // 2. Fetch Chapters if subjectId is provided
    if (subjectId) {
      const chapters = await prisma.academicChapter.findMany({
        where: { subjectId, isActive: true },
        orderBy: { displayOrder: 'asc' },
        include: {
          book: true,
          _count: { select: { topics: true } },
        },
      });

      return NextResponse.json({
        success: true,
        data: chapters.map((ch) => ({
          id: ch.id,
          chapterNumber: ch.chapterNumber,
          title: isHindi && ch.titleHindi ? ch.titleHindi : ch.title,
          titleEng: ch.title,
          titleHindi: ch.titleHindi,
          bookName: ch.book ? (isHindi && ch.book.titleHindi ? ch.book.titleHindi : ch.book.title) : null,
          displayOrder: ch.displayOrder,
          isSystem: ch.isSystem,
          topicCount: ch._count.topics,
        })),
      });
    }

    // 3. Fetch Subjects if classId is provided
    if (classId) {
      const where: any = { classId, isActive: true };
      if (program === 'NEET') {
        where.name = { in: ['Physics', 'Chemistry', 'Biology'] };
      } else if (program === 'JEE_MAIN' || program === 'JEE_ADVANCED') {
        where.name = { in: ['Physics', 'Chemistry', 'Mathematics'] };
      }

      const subjects = await prisma.academicSubject.findMany({
        where,
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { chapters: true } },
        },
      });

      return NextResponse.json({
        success: true,
        data: subjects.map((s) => ({
          id: s.id,
          name: isHindi && s.nameHindi ? s.nameHindi : s.name,
          nameEng: s.name,
          nameHindi: s.nameHindi,
          code: s.code,
          isSystem: s.isSystem,
          chapterCount: s._count.chapters,
        })),
      });
    }

    // 4. Fetch All Classes
    const classes = await prisma.academicClass.findMany({
      where: { isActive: true },
      orderBy: { numericValue: 'asc' },
      include: {
        subjects: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: classes.map((c) => ({
        id: c.id,
        name: c.name,
        numericValue: c.numericValue,
        subjects: c.subjects.map((s) => ({
          id: s.id,
          name: isHindi && s.nameHindi ? s.nameHindi : s.name,
          nameEng: s.name,
          nameHindi: s.nameHindi,
          isSystem: s.isSystem,
        })),
      })),
    });
  } catch (error: any) {
    console.error('Error in academic hierarchy API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch academic hierarchy' },
      { status: 500 }
    );
  }
}