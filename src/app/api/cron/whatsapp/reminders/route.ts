import { NextRequest, NextResponse } from "next/server";
import { processTeacherClassReminders } from "@/lib/whatsapp/reminders";
import { processWhatsAppQueue } from "@/lib/whatsapp/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const reminderResult = await processTeacherClassReminders();
    const queueResult = await processWhatsAppQueue(25);

    return NextResponse.json({
      success: true,
      reminders: reminderResult,
      queue: queueResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[CRON_WHATSAPP_TEACHER_REMINDERS_ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
