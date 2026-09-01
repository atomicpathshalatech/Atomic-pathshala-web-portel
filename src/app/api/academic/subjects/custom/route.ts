import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CustomSubjectSchema } from '@/lib/validation/academic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CustomSubjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
    }

    const { classId, name, nameHindi, code } = parsed.data;

    const classRecord = await prisma.academicClass.findUnique({
      where: { id: classId },
    });
    if (!classRecord) {
      return NextResponse.json({ success: false, error: 'Invalid Class ID' }, { status: 400 });
    }

    const existing = await prisma.academicSubject.findFirst({
      where: {
        classId,
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Subject "${name}" already exists in this class` },
        { status: 409 }
      );
    }

    const subject = await prisma.academicSubject.create({
      data: {
        classId,
        name,
        nameHindi: nameHindi || null,
        code: code || null,
        isSystem: false,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, data: subject }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating custom subject:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create custom subject' },
      { status: 500 }
    );
  }
}