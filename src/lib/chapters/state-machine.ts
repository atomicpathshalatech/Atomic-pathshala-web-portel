import "server-only";

export type ChapterStatusValue =
  | "DRAFT"
  | "LECTURES_IN_PROGRESS"
  | "LECTURES_COMPLETE"
  | "TESTS_PENDING"
  | "READY_TO_PUBLISH"
  | "PUBLISHED"
  | "ARCHIVED";

/**
 * Valid forward/backward transitions for a Chapter's production state
 * machine. Backend-enforced here — the status-transition route checks
 * this map, not just a disabled button in the UI — so a request crafted
 * directly against the API can't skip straight to PUBLISHED.
 *
 * DRAFT -> LECTURES_IN_PROGRESS -> LECTURES_COMPLETE -> TESTS_PENDING ->
 * READY_TO_PUBLISH -> PUBLISHED -> ARCHIVED, with a few backward moves
 * allowed (e.g. pulling a published chapter back to fix something) and
 * ARCHIVED reachable from any non-terminal state.
 */
const TRANSITIONS: Record<ChapterStatusValue, ChapterStatusValue[]> = {
  DRAFT: ["LECTURES_IN_PROGRESS", "ARCHIVED"],
  LECTURES_IN_PROGRESS: ["DRAFT", "LECTURES_COMPLETE", "ARCHIVED"],
  LECTURES_COMPLETE: ["LECTURES_IN_PROGRESS", "TESTS_PENDING", "ARCHIVED"],
  TESTS_PENDING: ["LECTURES_COMPLETE", "READY_TO_PUBLISH", "ARCHIVED"],
  READY_TO_PUBLISH: ["TESTS_PENDING", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["READY_TO_PUBLISH", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function canTransition(from: ChapterStatusValue, to: ChapterStatusValue): boolean {
  if (from === to) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextValidStates(from: ChapterStatusValue): ChapterStatusValue[] {
  return TRANSITIONS[from] ?? [];
}
