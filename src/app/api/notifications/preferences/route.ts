import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

const DEFAULT_PREFERENCES = {
  classes: true,
  tests: true,
  dpps: true,
  announcements: true,
  dailyTargets: true,
  pushEnabled: true,
  inAppEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const pref = await prisma.notificationPreference.findUnique({
      where: { userId: session.user.id },
    });

    return apiSuccess({
      preferences: pref || {
        userId: session.user.id,
        ...DEFAULT_PREFERENCES,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const body = await req.json();

    const pref = await prisma.notificationPreference.upsert({
      where: { userId: session.user.id },
      update: {
        classes: body.classes ?? undefined,
        tests: body.tests ?? undefined,
        dpps: body.dpps ?? undefined,
        announcements: body.announcements ?? undefined,
        dailyTargets: body.dailyTargets ?? undefined,
        pushEnabled: body.pushEnabled ?? undefined,
        inAppEnabled: body.inAppEnabled ?? undefined,
        quietHoursEnabled: body.quietHoursEnabled ?? undefined,
        quietHoursStart: body.quietHoursStart ?? undefined,
        quietHoursEnd: body.quietHoursEnd ?? undefined,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        classes: body.classes ?? true,
        tests: body.tests ?? true,
        dpps: body.dpps ?? true,
        announcements: body.announcements ?? true,
        dailyTargets: body.dailyTargets ?? true,
        pushEnabled: body.pushEnabled ?? true,
        inAppEnabled: body.inAppEnabled ?? true,
        quietHoursEnabled: body.quietHoursEnabled ?? false,
        quietHoursStart: body.quietHoursStart ?? "22:00",
        quietHoursEnd: body.quietHoursEnd ?? "07:00",
      },
    });

    return apiSuccess({ preferences: pref });
  } catch (error) {
    return handleApiError(error);
  }
}
