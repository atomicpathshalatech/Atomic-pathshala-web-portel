import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";
import { logAiChatEvent } from "@/lib/ai-chat/audit";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  const { id } = await context.params;
  const prisma = getPrisma();
  const result = await prisma.conversation.updateMany({
    where: { id, userId: user.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (!result.count) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  await logAiChatEvent({
    actorUserId: user.id,
    targetUserId: user.id,
    event: "CHAT_DELETED",
    entityType: "Conversation",
    entityId: id,
  });

  return new NextResponse(null, { status: 204 });
}
