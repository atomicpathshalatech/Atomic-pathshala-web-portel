import "server-only";
import { prisma } from "@/lib/db";
import { fetchLiveChatMessages, getLiveChatIdForVideo, youtubeLiveConfigured } from "@/lib/youtube/live-broadcast";
import { collectChatVotes, type PollOption } from "@/lib/live-class/youtube-poll";

/**
 * Reads the class's YouTube live chat and stores poll answers typed there
 * (see youtube-poll.ts for what counts as an answer). Driven by the teacher's
 * room while a poll is open, plus once more at reveal for late messages.
 *
 * The chat cursor lives here per poll, like the chat route's cache: a cold
 * instance simply starts from YouTube's recent backlog again, and the
 * (poll, account) unique key makes re-reading harmless.
 */
const cursors = new Map<string, { pageToken?: string; fetchedAt: number }>();
const MIN_INTERVAL_MS = 3000;

export async function syncYoutubeVotes(quizSessionId: string, opts: { force?: boolean } = {}): Promise<{ ok: boolean; added: number }> {
  try {
    if (!youtubeLiveConfigured()) return { ok: false, added: 0 };
    const quiz = await prisma.quizSession.findUnique({
      where: { id: quizSessionId },
      select: {
        id: true,
        options: true,
        startedAt: true,
        timeLimitSec: true,
        whiteboardSession: { select: { id: true, youtubeLiveChatId: true, youtubeVideoId: true } },
      },
    });
    if (!quiz) return { ok: false, added: 0 };

    const cursor = cursors.get(quizSessionId);
    if (!opts.force && cursor && Date.now() - cursor.fetchedAt < MIN_INTERVAL_MS) return { ok: true, added: 0 };

    let liveChatId = quiz.whiteboardSession.youtubeLiveChatId;
    if (!liveChatId && quiz.whiteboardSession.youtubeVideoId) {
      liveChatId = await getLiveChatIdForVideo(quiz.whiteboardSession.youtubeVideoId);
      if (liveChatId) {
        await prisma.whiteboardSession
          .update({ where: { id: quiz.whiteboardSession.id }, data: { youtubeLiveChatId: liveChatId } })
          .catch(() => undefined);
      }
    }
    if (!liveChatId) return { ok: false, added: 0 };

    cursors.set(quizSessionId, { pageToken: cursor?.pageToken, fetchedAt: Date.now() });
    const chat = await fetchLiveChatMessages(liveChatId, cursor?.pageToken);
    cursors.set(quizSessionId, { pageToken: chat.nextPageToken ?? cursor?.pageToken, fetchedAt: Date.now() });

    const votes = collectChatVotes(
      chat.messages.map((m) => ({ ...m, authorPhotoUrl: m.authorPhotoUrl ?? null })),
      { options: quiz.options as unknown as PollOption[], startedAt: quiz.startedAt, timeLimitSec: quiz.timeLimitSec }
    );
    if (votes.length === 0) return { ok: true, added: 0 };
    const res = await prisma.quizYoutubeVote.createMany({
      data: votes.map((v) => ({ ...v, quizSessionId })),
      skipDuplicates: true,
    });
    return { ok: true, added: res.count };
  } catch (err) {
    // Quota, a chat that's gone, or the table not migrated yet: the in-app
    // poll must keep working regardless.
    console.warn("[youtube_votes_sync]", err instanceof Error ? err.message : err);
    return { ok: false, added: 0 };
  }
}

/** Per-option counts of YouTube chat answers (empty if none / not available). */
export async function youtubeVoteCounts(quizSessionId: string): Promise<{ counts: Record<string, number>; total: number }> {
  try {
    const grouped = await prisma.quizYoutubeVote.groupBy({
      by: ["selectedOption"],
      where: { quizSessionId },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(grouped.map((g) => [g.selectedOption, g._count._all]));
    const total = grouped.reduce((n, g) => n + g._count._all, 0);
    return { counts, total };
  } catch {
    return { counts: {}, total: 0 };
  }
}

/** Marks YouTube answers right/wrong once the teacher reveals the answer. */
export async function markYoutubeVotes(quizSessionId: string, correctOption: string) {
  try {
    await prisma.$executeRaw`UPDATE quiz_youtube_votes SET "isCorrect" = ("selectedOption" = ${correctOption}) WHERE "quizSessionId" = ${quizSessionId}`;
  } catch (err) {
    console.warn("[youtube_votes_mark]", err instanceof Error ? err.message : err);
  }
}

/** Adds two per-option count maps. */
export function addCounts(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}
