import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const newsletterSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = newsletterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid email" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    await prisma.auditLog.create({
      data: {
        action: "NEWSLETTER_SUBSCRIBE",
        entityType: "Newsletter",
        entityId: email,
        metadata: { email, subscribedAt: new Date().toISOString() },
      },
    }).catch(() => {
      // Non-blocking in case auditLog table is constrained
    });

    return NextResponse.json({
      success: true,
      message: "Thank you for subscribing to Atomic Pathshala newsletter!",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
