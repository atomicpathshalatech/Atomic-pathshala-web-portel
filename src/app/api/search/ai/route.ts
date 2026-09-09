import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { tokenize, containsAll } from "@/lib/search/normalize";
import { resolveSearchScope } from "@/lib/search/scope";
import { retrieveAll, findClasses } from "@/lib/search/retrieve";
import { rankResults } from "@/lib/search/rank";
import { parseIntent, composeAnswer, NO_RESULT_ANSWER } from "@/lib/search/ai";
import type { SearchResult } from "@/lib/search/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Light per-user throttle — the AI path costs a Gemini call.
const hits = new Map<string, { n: number; resetAt: number }>();
function throttle(userId: string): boolean {
  const now = Date.now();
  const e = hits.get(userId);
  if (!e || now > e.resetAt) {
    hits.set(userId, { n: 1, resetAt: now + 60_000 });
    return true;
  }
  if (e.n >= 15) return false;
  e.n++;
  return true;
}

/**
 * POST /api/search/ai   { "query": "Firoz sir ne Current Electricity kab padhaya?" }
 *
 * Natural-language search. It NEVER guesses: it resolves the same
 * permission scope as /api/search, retrieves real rows, and only then asks
 * Gemini to phrase an answer grounded strictly in those rows. No rows ->
 * the fixed "not found" sentence, no LLM call.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    if (!throttle(session.user.id)) {
      return apiError("Too many AI searches — wait a minute and try again.", 429);
    }

    const body = await request.json().catch(() => ({}));
    const query = String(body?.query ?? "").trim();
    if (query.length < 3) return apiError("Ask a full question.", 400);
    if (query.length > 400) return apiError("That question is too long.", 400);

    const scope = await resolveSearchScope(session.user.id);
    const intent = await parseIntent(query);

    const personTokens = intent.personName ? tokenize(intent.personName) : [];
    const chapterTokens = intent.chapter ? tokenize(intent.chapter) : [];
    const genericTokens =
      intent.keywords.length > 0 ? intent.keywords.map((k) => k.toLowerCase()) : tokenize(query);

    const sources: SearchResult[] = [];

    // 1. Targeted class lookup when the question is about a class/date/teacher.
    if (
      intent.wantsClasses ||
      intent.dateFrom ||
      personTokens.length > 0 ||
      chapterTokens.length > 0
    ) {
      const and: Record<string, unknown>[] = [];
      if (intent.dateFrom && intent.dateTo) {
        and.push({ startsAt: { gte: new Date(intent.dateFrom), lte: new Date(intent.dateTo) } });
      }
      if (personTokens.length > 0) {
        and.push({ teacher: { user: containsAll("name", personTokens) } });
      }
      if (chapterTokens.length > 0) {
        and.push({
          OR: [
            { chapter: containsAll("title", chapterTokens) },
            containsAll("title", chapterTokens),
            containsAll("subject", chapterTokens),
          ],
        });
      }
      if (intent.subject) {
        and.push({ subject: { contains: intent.subject, mode: "insensitive" } });
      }

      const classHits = await findClasses(scope, [], {
        extraWhere: and.length > 0 ? { AND: and } : undefined,
        take: 15,
      });
      sources.push(...classHits);
    }

    // 2. General retrieval as a safety net / for people & content questions.
    if (sources.length < 5) {
      const general = await retrieveAll(
        scope,
        genericTokens.length > 0 ? genericTokens : tokenize(query)
      );
      sources.push(...general);
    }

    // Dedupe + rank against the original question.
    const seen = new Set<string>();
    const deduped = sources.filter((s) => {
      const k = `${s.type}:${s.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const ranked = rankResults(deduped, `${intent.personName ?? ""} ${intent.chapter ?? ""} ${query}`)
      .slice(0, 12);

    if (ranked.length === 0) {
      return apiSuccess({ answer: NO_RESULT_ANSWER, sources: [], intent });
    }

    const answer = await composeAnswer(query, ranked);
    return apiSuccess({ answer, sources: ranked.slice(0, 6), intent });
  } catch (error) {
    if (error instanceof UnauthorizedError) return apiError("Please sign in.", 401);
    return handleApiError(error);
  }
}
