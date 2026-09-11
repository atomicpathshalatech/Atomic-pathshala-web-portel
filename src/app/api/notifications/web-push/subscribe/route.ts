import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = subscribeSchema.parse(body);

    const subscription = await prisma.webPushSubscription.upsert({
      where: { endpoint: data.endpoint },
      update: {
        userId: session.user.id,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent: data.userAgent || req.headers.get("user-agent") || null,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent: data.userAgent || req.headers.get("user-agent") || null,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, id: subscription.id });
  } catch (err: any) {
    console.error("[WebPush Subscription Error]", err);
    return NextResponse.json({ error: err?.message || "Invalid payload" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { endpoint } = await req.json();
    if (endpoint) {
      await prisma.webPushSubscription.updateMany({
        where: { endpoint, userId: session.user.id },
        data: { isActive: false },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 400 });
  }
}
