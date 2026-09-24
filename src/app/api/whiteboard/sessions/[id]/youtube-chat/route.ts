import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError } from "@/lib/api/response";
import {
  fetchLiveChatMessages,
  getLiveChatIdForVideo,
  youtubeLiveConfigured,
} from "@/lib/youtube/live-broadcast";

type CachedChatResponse = {
  messages: ReturnType<typeof formatMessages>;
  nextPageToken?: string;
  pollingIntervalMillis?: number;
  youtubeVotes: Array<{ authorName: string; option: string }>;
};

type ChatCacheEntry = {
  fetchedAt: number;
  // The pageToken to use for the NEXT upstream call — owned by the server,
  // not by any individual client, so this survives across whichever client
  // happens to trigger the next real fetch.
  pageToken: string | undefined;
  response: CachedChatResponse;
};

// Every connected viewer's own browser used to poll this route directly
// every 4s (see MessagesPanel.tsx), each one making its own YouTube API
// call — with N concurrent students that's N x the quota burn for the exact
// same chat, which is what actually exhausted the daily quota (confirmed in
// prod logs: 403 quotaExceeded). This process-local cache means every
// viewer of the SAME class within the same short window gets one shared
// upstream call instead of one each — a Vercel serverless instance is
// frequently reused for consecutive requests under normal load, so this
// cuts real-world quota usage by roughly the concurrent-viewer count without
// needing a database migration or a shared cache service. Not a *guarantee*
// (a cold Lambda has an empty cache), but a large, immediately-deployable
// reduction paired with the client now honoring YouTube's own suggested
// pollingIntervalMillis instead of a hardcoded 4s.
const chatCache = new Map<string, ChatCacheEntry>();
const CHAT_CACHE_TTL_MS = 4000;

function formatMessages(messages: Awaited<ReturnType<typeof fetchLiveChatMessages>>["messages"]) {
  return messages.map((m) => ({
    id: `yt_${m.id}`,
    authorRole: "STUDENT" as const,
    authorUserId: `yt_user_${m.authorName.replace(/\s+/g, "_")}`,
    authorName: m.authorName,
    authorPhotoUrl: m.authorPhotoUrl,
    body: m.messageText,
    createdAt: m.publishedAt,
    source: "YOUTUBE" as const,
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        youtubeVideoId: true,
        youtubeLiveChatId: true,
        livePhase: true,
      },
    });

    if (!wbSession) return apiError("Whiteboard session not found", 404);

    if (!youtubeLiveConfigured()) {
      return apiSuccess({ messages: [], active: false });
    }

    let liveChatId = wbSession.youtubeLiveChatId;
    if (!liveChatId && wbSession.youtubeVideoId) {
      liveChatId = await getLiveChatIdForVideo(wbSession.youtubeVideoId);
      if (liveChatId) {
        await prisma.whiteboardSession
          .update({
            where: { id: wbSession.id },
            data: { youtubeLiveChatId: liveChatId },
          })
          .catch(() => {});
      }
    }

    if (!liveChatId) {
      return apiSuccess({ messages: [], active: false });
    }

    // Server-owned cache/cursor — see the chatCache doc comment above. Every
    // viewer of this same class within CHAT_CACHE_TTL_MS gets this identical
    // cached response instead of each triggering their own YouTube call; any
    // client-supplied ?pageToken= is ignored on purpose, since the pagination
    // cursor is now tracked here, not per-client.
    const cached = chatCache.get(params.id);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < CHAT_CACHE_TTL_MS) {
      return apiSuccess({ ...cached.response, active: true });
    }

    const chatData = await fetchLiveChatMessages(liveChatId, cached?.pageToken);
    const formattedMessages = formatMessages(chatData.messages);

    // Ingest YouTube votes if an active quiz exists
    const activeQuiz = await prisma.quizSession.findFirst({
      where: { whiteboardSessionId: params.id, status: "ACTIVE" },
      select: { id: true, options: true },
    });

    const youtubeVotes: Array<{ authorName: string; option: string }> = [];
    if (activeQuiz) {
      const validOptions = (activeQuiz.options as Array<{ key: string }>).map((o) =>
        o.key.toUpperCase()
      );
      for (const m of chatData.messages) {
        const text = m.messageText.trim().toUpperCase();
        if (validOptions.includes(text)) {
          youtubeVotes.push({ authorName: m.authorName, option: text });
        }
      }
    }

    const response: CachedChatResponse = {
      messages: formattedMessages,
      nextPageToken: chatData.nextPageToken,
      pollingIntervalMillis: chatData.pollingIntervalMillis,
      youtubeVotes,
    };
    chatCache.set(params.id, { fetchedAt: now, pageToken: chatData.nextPageToken, response });

    return apiSuccess({ ...response, active: true });
  } catch (error) {
    // If YouTube quota or token fails, gracefully return empty rather than breaking the UI
    console.warn("[youtube_chat_fetch_warning]", error);
    return apiSuccess({ messages: [], active: false });
  }
}
