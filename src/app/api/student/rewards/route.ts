import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { STORE_ITEMS } from "@/lib/gamification/store-items";

const redeemSchema = z.object({
  itemId: z.string().min(1),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true, xp: true, level: true, currentStreakDays: true },
    });
    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        student,
        items: STORE_ITEMS,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Could not load rewards" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true, xp: true },
    });
    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = redeemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid item" }, { status: 400 });
    }

    const item = STORE_ITEMS.find((i) => i.id === parsed.data.itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: "Item not found in reward store" }, { status: 404 });
    }

    if (student.xp < item.costXp) {
      return NextResponse.json(
        { success: false, error: `Insufficient XP. You need ${item.costXp} XP (current: ${student.xp} XP).` },
        { status: 400 }
      );
    }

    // Deduct XP and log redemption
    const newXp = student.xp - item.costXp;
    
    // If student redeemed Streak Freeze / Repair, restore their active streak to their longest streak
    let streakUpdateData: { currentStreakDays?: number; lastActivityDate?: Date } = {};
    let customMessage = `Successfully unlocked "${item.title}"!`;

    if (item.id === "item_streak_freeze") {
      const studentData = await prisma.student.findUnique({
        where: { id: student.id },
        select: { currentStreakDays: true, longestStreakDays: true },
      });
      const restoredStreak = Math.max(studentData?.currentStreakDays || 0, studentData?.longestStreakDays || 1);
      streakUpdateData = {
        currentStreakDays: restoredStreak,
        lastActivityDate: new Date(),
      };
      customMessage = `🔥 Streak Freeze Shield Activated! Your study streak has been restored to ${restoredStreak} Days.`;
    }

    await prisma.$transaction([
      prisma.student.update({
        where: { id: student.id },
        data: {
          xp: newXp,
          ...streakUpdateData,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "REWARD_REDEEMED",
          entityType: "RewardItem",
          entityId: item.id,
          metadata: {
            itemTitle: item.title,
            costXp: item.costXp,
            remainingXp: newXp,
            streakRestored: streakUpdateData.currentStreakDays ?? null,
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: customMessage,
      data: { remainingXp: newXp, item, restoredStreak: streakUpdateData.currentStreakDays },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Redemption failed. Please try again." }, { status: 500 });
  }
}
