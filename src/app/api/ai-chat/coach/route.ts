import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser, UnauthorizedError } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";
import { generateCoachReply } from "@/lib/ai-chat/gemini";
import { getProgressSnapshot, buildCoachPrompt } from "@/lib/ai-chat/coach";
import { getGeminiErrorDetails } from "@/lib/ai-chat/errors";

export const runtime = "nodejs";

/**
 * One ongoing coach conversation per student (unlike the main doubt-solver,
 * which supports many named conversations) — a progress coach is naturally
 * a single running thread, not a list of separate chats. Not gated on
 * subscription/daily limits like /api/ai-chat/chat — a deliberate, disclosed
 * scope decision (this is a lighter-weight engagement feature, not the
 * primary paid doubt-solving surface); revisit if it should be gated too.
 */
export async function GET() {
  try {
    const user = await requireCurrentUser();
    const prisma = getPrisma();

    const conversation = await prisma.coachConversation.findUnique({
      where: { userId: user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json({ messages: conversation?.messages ?? [] });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }
    console.error("[Coach API]", error);
    return NextResponse.json({ error: "Could not load your coach chat." }, { status: 500 });
  }
}

const postSchema = z.object({ message: z.string().trim().min(1).max(2000) });

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const prisma = getPrisma();
    const { message } = postSchema.parse(await request.json());

    const conversation = await prisma.coachConversation.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    const snapshot = await getProgressSnapshot(user.id);
    const prompt = buildCoachPrompt(
      snapshot,
      conversation.messages.map((m) => ({ role: m.role, content: m.content })),
      message
    );

    const replyText = await generateCoachReply(prompt);

    const [userMessage, coachMessage] = await prisma.$transaction([
      prisma.coachMessage.create({
        data: { conversationId: conversation.id, role: "USER", content: message },
      }),
      prisma.coachMessage.create({
        data: { conversationId: conversation.id, role: "ASSISTANT", content: replyText },
      }),
    ]);
    await prisma.coachConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ userMessage, coachMessage });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Message can't be empty." }, { status: 422 });
    }
    console.error("[Coach API]", getGeminiErrorDetails(error));
    return NextResponse.json(
      { error: "Something went wrong reaching your coach. Please try again." },
      { status: 500 }
    );
  }
}
