import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";
import { logAiChatEvent } from "@/lib/ai-chat/audit";
import type { ChatSession, Language } from "@/types/ai-chat";

const languageSchema = z.enum(["english", "hindi", "hinglish"]);
const attachmentSchema = z.object({
  id: z.string().min(1).max(200),
  kind: z.enum(["image", "pdf"]),
  name: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(200),
  size: z.number().int().min(0).max(25 * 1024 * 1024),
  url: z.string().url().max(2_000).optional(),
  extractedText: z.string().max(100_000).optional(),
});
const messageSchema = z.object({
  id: z.string().min(1).max(200),
  role: z.enum(["user", "assistant"]),
  content: z.string().max(100_000),
  timestamp: z.number().int().positive(),
  editedAt: z.number().int().positive().optional(),
  attachments: z.array(attachmentSchema).max(8).optional(),
});
const chatSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(250),
  language: languageSchema,
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  messages: z.array(messageSchema).max(500),
});
const syncSchema = z.object({ chats: z.array(chatSchema).max(500) });

function unauthorized() {
  return NextResponse.json({ error: "Sign in is required to sync history." }, { status: 401 });
}

function toTimestamp(date: Date) {
  return date.getTime();
}

function asLanguage(value: string): Language {
  return value === "english" || value === "hindi" || value === "hinglish"
    ? value
    : "hinglish";
}

function toChatSession(conversation: {
  id: string;
  title: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id: string;
    role: "USER" | "ASSISTANT";
    content: string;
    createdAt: Date;
    editedAt: Date | null;
    attachments: Array<{
      id: string;
      kind: "IMAGE" | "PDF" | "AUDIO" | "DOCUMENT";
      name: string;
      mimeType: string;
      size: number;
      url: string | null;
      extractedText: string | null;
    }>;
  }>;
}): ChatSession {
  return {
    id: conversation.id,
    title: conversation.title,
    language: asLanguage(conversation.language),
    createdAt: toTimestamp(conversation.createdAt),
    updatedAt: toTimestamp(conversation.updatedAt),
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role === "USER" ? "user" : "assistant",
      content: message.content,
      timestamp: toTimestamp(message.createdAt),
      editedAt: message.editedAt ? toTimestamp(message.editedAt) : undefined,
      attachments: message.attachments
        .filter((attachment) => attachment.kind === "IMAGE" || attachment.kind === "PDF")
        .map((attachment) => ({
          id: attachment.id,
          kind: attachment.kind === "IMAGE" ? "image" : "pdf",
          name: attachment.name,
          mimeType: attachment.mimeType,
          size: attachment.size,
          url: attachment.url ?? undefined,
          extractedText: attachment.extractedText ?? undefined,
        })),
    })),
  };
}

async function getOwnedChats(userId: string) {
  const prisma = getPrisma();
  return prisma.conversation.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { attachments: true },
      },
    },
  });
}

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const conversations = await getOwnedChats(user.id);
  return NextResponse.json({ chats: conversations.map(toChatSession) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = syncSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid chat history." },
      { status: 400 }
    );
  }

  const prisma = getPrisma();

  try {
    for (const chat of parsed.data.chats) {
      const existingConversation = await prisma.conversation.findUnique({
        where: { id: chat.id },
        select: { userId: true, updatedAt: true },
      });
      if (existingConversation && existingConversation.userId !== user.id) {
        continue;
      }

      const incomingUpdatedAt = new Date(chat.updatedAt);
      const keepServerMetadata =
        existingConversation && existingConversation.updatedAt > incomingUpdatedAt;
      await prisma.conversation.upsert({
        where: { id: chat.id },
        create: {
          id: chat.id,
          userId: user.id,
          title: chat.title,
          language: chat.language,
          createdAt: new Date(chat.createdAt),
          updatedAt: incomingUpdatedAt,
        },
        update: keepServerMetadata
          ? { deletedAt: null }
          : {
              title: chat.title,
              language: chat.language,
              updatedAt: incomingUpdatedAt,
              deletedAt: null,
            },
      });

      for (const message of chat.messages) {
        const existingMessage = await prisma.chatMessage.findUnique({
          where: { id: message.id },
          select: { conversationId: true },
        });
        if (existingMessage && existingMessage.conversationId !== chat.id) continue;

        await prisma.chatMessage.upsert({
          where: { id: message.id },
          create: {
            id: message.id,
            conversationId: chat.id,
            role: message.role === "user" ? "USER" : "ASSISTANT",
            content: message.content,
            createdAt: new Date(message.timestamp),
            editedAt: message.editedAt ? new Date(message.editedAt) : null,
          },
          update: {
            role: message.role === "user" ? "USER" : "ASSISTANT",
            content: message.content,
            editedAt: message.editedAt ? new Date(message.editedAt) : null,
          },
        });

        for (const attachment of message.attachments ?? []) {
          await prisma.messageAttachment.upsert({
            where: { id: attachment.id },
            create: {
              id: attachment.id,
              messageId: message.id,
              kind: attachment.kind === "image" ? "IMAGE" : "PDF",
              name: attachment.name,
              mimeType: attachment.mimeType,
              size: attachment.size,
              url: attachment.url,
              extractedText: attachment.extractedText,
            },
            update: {
              name: attachment.name,
              mimeType: attachment.mimeType,
              size: attachment.size,
              url: attachment.url,
              extractedText: attachment.extractedText,
            },
          });
        }
      }
    }

    await logAiChatEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      event: "CHAT_SYNCED",
      entityType: "Conversation",
      metadata: { conversations: parsed.data.chats.length },
    });
  } catch (error) {
    console.error("[Chat sync API]", error);
    return NextResponse.json({ error: "Could not sync chat history." }, { status: 500 });
  }

  const conversations = await getOwnedChats(user.id);
  return NextResponse.json({ chats: conversations.map(toChatSession) });
}
