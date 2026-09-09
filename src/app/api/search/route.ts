import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { tokenize } from "@/lib/search/normalize";
import { resolveSearchScope } from "@/lib/search/scope";
import { retrieveAll } from "@/lib/search/retrieve";
import { rankResults } from "@/lib/search/rank";
import {
  GROUP_LABELS,
  GROUP_ORDER,
  type SearchEntityType,
  type SearchGroup,
  type SearchResult,
} from "@/lib/search/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=firoz&limit=5&types=teacher,class&mode=full
 *
 * Permission-aware global search. Authorisation is resolved server-side in
 * resolveSearchScope() and enforced inside retrieve.ts — the client cannot
 * widen it with `types` (that only narrows), and no result for an entity
 * the caller can't read is ever produced.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const rawQuery = (searchParams.get("q") ?? "").trim();
    const mode = searchParams.get("mode") === "suggest" ? "suggest" : "full";
    const perGroup = Math.min(
      20,
      Math.max(1, Number(searchParams.get("limit") ?? (mode === "suggest" ? 4 : 6)))
    );
    const typeFilter = (searchParams.get("types") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean) as SearchEntityType[];

    if (rawQuery.length < 2) {
      return apiSuccess({ query: rawQuery, groups: [], partial: false });
    }

    const tokens = tokenize(rawQuery);
    if (tokens.length === 0) {
      return apiSuccess({ query: rawQuery, groups: [], partial: false });
    }

    const scope = await resolveSearchScope(session.user.id);
    const raw = await retrieveAll(scope, tokens, { suggest: mode === "suggest" });
    const ranked = rankResults(raw, rawQuery);

    // Group, keeping GROUP_ORDER, trimming to `perGroup`.
    const byType = new Map<SearchEntityType, SearchResult[]>();
    for (const r of ranked) {
      if (typeFilter.length > 0 && !typeFilter.includes(r.type)) continue;
      const list = byType.get(r.type) ?? [];
      if (list.length < perGroup) list.push(r);
      byType.set(r.type, list);
    }

    const groups: SearchGroup[] = [];
    const seenLabels = new Set<string>();
    for (const type of GROUP_ORDER) {
      const results = byType.get(type);
      if (!results || results.length === 0) continue;
      // "People" covers teacher/student/team_member — merge under one heading.
      const label = GROUP_LABELS[type];
      const existing = groups.find((g) => g.label === label && label === "People");
      if (existing) {
        existing.results.push(...results);
      } else {
        groups.push({ type, label, results: [...results] });
        seenLabels.add(label);
      }
    }

    return apiSuccess({
      query: rawQuery,
      groups,
      partial: false,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return apiError("Please sign in to search.", 401);
    return handleApiError(error);
  }
}
