import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { DevicePlatform } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const body = await req.json();
    const { fcmToken, platform = "WEB", deviceInfo } = body;

    if (!fcmToken || typeof fcmToken !== "string") {
      return apiError("Missing valid fcmToken", 400);
    }

    let validPlatform: DevicePlatform = DevicePlatform.WEB;
    if (platform === "ANDROID") validPlatform = DevicePlatform.ANDROID;
    else if (platform === "IOS") validPlatform = DevicePlatform.IOS;

    const device = await prisma.userDevice.upsert({
      where: { fcmToken },
      update: {
        userId: session.user.id,
        platform: validPlatform,
        deviceInfo: deviceInfo || undefined,
        isActive: true,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        fcmToken,
        platform: validPlatform,
        deviceInfo: deviceInfo || undefined,
        isActive: true,
      },
    });

    return apiSuccess({ deviceId: device.id, registered: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const body = await req.json();
    const { fcmToken } = body;

    if (!fcmToken) {
      return apiError("Missing fcmToken", 400);
    }

    await prisma.userDevice.updateMany({
      where: {
        fcmToken,
        userId: session.user.id,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    return apiSuccess({ unregistered: true });
  } catch (error) {
    return handleApiError(error);
  }
}
