import { NextResponse } from "next/server";
import { requireScheduleManager, UnauthorizedError, ForbiddenError } from "@/lib/ai-chat/auth";
import { classScheduleSchema } from "@/lib/ai-chat/validation";
import { getPrisma } from "@/lib/ai-chat/prisma";

function accessError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Admin or faculty access is required." }, { status: 403 });
  }
  return null;
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireScheduleManager();
    const params = new URL(request.url).searchParams;
    const batch = params.get("batch")?.trim();

    const prisma = getPrisma();
    const schedules = await prisma.classSchedule.findMany({
      where: batch ? { batch: batch as never } : undefined,
      orderBy: [{ classDate: "asc" }, { startTime: "asc" }],
      take: 200,
    });

    return NextResponse.json({ schedules });
  } catch (error) {
    const response = accessError(error);
    if (response) return response;
    console.error("[Schedule API]", error);
    return NextResponse.json({ error: "Could not load schedule." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireScheduleManager();
    const parsed = classScheduleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid schedule details." },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    const schedule = await prisma.classSchedule.create({
      data: {
        batch: parsed.data.batch,
        classDate: new Date(parsed.data.classDate),
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime || null,
        subject: parsed.data.subject,
        teacherName: parsed.data.teacherName || null,
        teacherPhotoUrl: parsed.data.teacherPhotoUrl || null,
        topic: parsed.data.topic,
        youtubeLink: parsed.data.youtubeLink || null,
        notes: parsed.data.notes || null,
      },
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    const response = accessError(error);
    if (response) return response;
    console.error("[Schedule API]", error);
    return NextResponse.json({ error: "Could not create schedule entry." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireScheduleManager();
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "Schedule id is required." }, { status: 400 });
    }

    const parsed = classScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid schedule details." },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    const schedule = await prisma.classSchedule.update({
      where: { id: body.id },
      data: {
        batch: parsed.data.batch,
        classDate: new Date(parsed.data.classDate),
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime || null,
        subject: parsed.data.subject,
        teacherName: parsed.data.teacherName || null,
        teacherPhotoUrl: parsed.data.teacherPhotoUrl || null,
        topic: parsed.data.topic,
        youtubeLink: parsed.data.youtubeLink || null,
        notes: parsed.data.notes || null,
      },
    });

    return NextResponse.json({ schedule });
  } catch (error) {
    const response = accessError(error);
    if (response) return response;
    console.error("[Schedule API]", error);
    return NextResponse.json({ error: "Could not update schedule entry." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireScheduleManager();
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    if (!id) {
      return NextResponse.json({ error: "Schedule id is required." }, { status: 400 });
    }

    const prisma = getPrisma();
    await prisma.classSchedule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const response = accessError(error);
    if (response) return response;
    console.error("[Schedule API]", error);
    return NextResponse.json({ error: "Could not delete schedule entry." }, { status: 500 });
  }
}
