import "server-only";
import { prisma } from "@/lib/db";
import { pushMessage } from "@/lib/whiteboard/messages";

/**
 * YouTube comments become part of the class chat.
 *
 * They used to exist only in the teacher's browser: students in the app never
 * saw them, and a refresh or rejoin wiped them. Each comment read from
 * YouTube is now stored once as a chat row (id "yt_<YouTube message id>", so
 * the same comment can never be stored twice) and pushed to everyone in the
 * room — after that it is ordinary chat history: every student sees it, and
 * it is still there after a refresh, a rejoin, or on another device.
 */

export const YOUTUBE_AUTHOR_ROLE = "YOUTUBE";

export type YoutubeChatMessage = {
  id: string;
  authorName: string;
  authorPhotoUrl?: string | null;
  messageText: string;
  publishedAt: string;
};

/** How many freshly stored comments are pushed live in one go (the rest arrive with the next history sync). */
const PUSH_LIMIT = 30;

export function youtubeChatRowId(youtubeMessageId: string): string {
  return `yt_${youtubeMessageId}`;
}

export function youtubeAuthorId(authorName: string): string {
  return `yt_user_${authorName.replace(/\s+/g, "_")}`.slice(0, 190);
}

export async function saveYoutubeChat(
  whiteboardSessionId: string,
  messages: YoutubeChatMessage[],
  opts: { push?: boolean } = {}
): Promise<{ stored: number }> {
  const usable = messages.filter((m) => m.id && m.messageText?.trim());
  if (usable.length === 0) return { stored: 0 };

  const ids = usable.map((m) => youtubeChatRowId(m.id));
  const existing = await prisma.whiteboardMessage.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const have = new Set(existing.map((e) => e.id));
  const fresh = usable.filter((m) => !have.has(youtubeChatRowId(m.id)));
  if (fresh.length === 0) return { stored: 0 };

  const rows = fresh.map((m) => {
    const at = new Date(m.publishedAt);
    return {
      id: youtubeChatRowId(m.id),
      whiteboardSessionId,
      authorRole: YOUTUBE_AUTHOR_ROLE,
      authorUserId: youtubeAuthorId(m.authorName),
      authorName: m.authorName.slice(0, 190),
      body: m.messageText.trim().slice(0, 2000),
      createdAt: Number.isNaN(at.getTime()) ? new Date() : at,
    };
  });
  const res = await prisma.whiteboardMessage.createMany({ data: rows, skipDuplicates: true });

  if (opts.push !== false) {
    const photos = new Map(fresh.map((m) => [youtubeChatRowId(m.id), m.authorPhotoUrl ?? null]));
    await Promise.allSettled(
      rows.slice(-PUSH_LIMIT).map((r) =>
        pushMessage(whiteboardSessionId, {
          id: r.id,
          authorRole: "STUDENT",
          authorUserId: r.authorUserId,
          authorName: r.authorName,
          authorPhotoUrl: photos.get(r.id) ?? null,
          body: r.body,
          createdAt: r.createdAt.toISOString(),
          source: "YOUTUBE",
        })
      )
    );
  }
  return { stored: res.count };
}
