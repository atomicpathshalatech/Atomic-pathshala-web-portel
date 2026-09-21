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

    const { searchParams } = new URL(request.url);
    const pageToken = searchParams.get("pageToken") || undefined;

    const chatData = await fetchLiveChatMessages(liveChatId, pageToken);

    // Format into ChatMessage structures
    const formattedMessages = chatData.messages.map((m) => ({
      id: `yt_${m.id}`,
      authorRole: "STUDENT" as const,
      authorUserId: `yt_user_${m.authorName.replace(/\s+/g, "_")}`,
      authorName: m.authorName,
      authorPhotoUrl: m.authorPhotoUrl,
      body: m.messageText,
      createdAt: m.publishedAt,
      source: "YOUTUBE" as const,
    }));

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

    return apiSuccess({
      messages: formattedMessages,
      nextPageToken: chatData.nextPageToken,
      pollingIntervalMillis: chatData.pollingIntervalMillis,
      youtubeVotes,
      active: true,
    });
  } catch (error) {
    // If YouTube quota or token fails, gracefully return empty rather than breaking the UI
    console.warn("[youtube_chat_fetch_warning]", error);
    return apiSuccess({ messages: [], active: false });
  }
}
