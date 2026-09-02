// Deliberately no "server-only" guard here, unlike most of this app's
// lib files — this state machine is pure functions/data with no DB access
// or secrets, and it's legitimately imported from both the server (the
// status-transition API route, which is the actual enforcement point) and
// the client (ChapterStatusActions.tsx, to know which buttons to render).

export type ChapterStatusValue =
  | "DRAFT"
  | "LECTURES_IN_PROGRESS"
  | "LECTURES_COMPLETE"
  | "TESTS_PENDING"
  | "READY_TO_PUBLISH"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "PUBLISHED"
  | "ARCHIVED";

/**
 * Statuses that only the review workflow may move a chapter into. The
 * generic status-transition route (POST /api/team/chapters/:id/status)
 * refuses any transition INTO one of these — they're reachable only via
 * POST .../submit (SUBMITTED -> UNDER_REVIEW) and POST .../review
 * (UNDER_REVIEW -> APPROVED/REJECTED/CHANGES_REQUESTED), both of which
 * require the reviewer to be someone other than the chapter's own author.
 * Leaving one of these states (e.g. CHANGES_REQUESTED back to
 * LECTURES_IN_PROGRESS, or APPROVED on to PUBLISHED) still goes through
 * the generic route — only entry is restricted.
 */
export const REVIEW_MANAGED_STATES: ChapterStatusValue[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
];

/**
 * Valid forward/backward transitions for a Chapter's production state
 * machine. Backend-enforced here — the status-transition route checks
 * this map, not just a disabled button in the UI — so a request crafted
 * directly against the API can't skip straight to PUBLISHED.
 *
 * DRAFT -> LECTURES_IN_PROGRESS -> LECTURES_COMPLETE -> TESTS_PENDING ->
 * READY_TO_PUBLISH -> SUBMITTED -> UNDER_REVIEW -> APPROVED -> PUBLISHED,
 * with REJECTED/CHANGES_REQUESTED branching back to authoring and a few
 * other backward moves allowed. ARCHIVED reachable from most states.
 */
const TRANSITIONS: Record<ChapterStatusValue, ChapterStatusValue[]> = {
  DRAFT: ["LECTURES_IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "ARCHIVED"],
  LECTURES_IN_PROGRESS: ["DRAFT", "LECTURES_COMPLETE", "SUBMITTED", "UNDER_REVIEW", "ARCHIVED"],
  LECTURES_COMPLETE: ["LECTURES_IN_PROGRESS", "TESTS_PENDING", "SUBMITTED", "UNDER_REVIEW", "ARCHIVED"],
  TESTS_PENDING: ["LECTURES_COMPLETE", "READY_TO_PUBLISH", "SUBMITTED", "UNDER_REVIEW", "ARCHIVED"],
  READY_TO_PUBLISH: ["TESTS_PENDING", "SUBMITTED", "UNDER_REVIEW", "ARCHIVED"],
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CHANGES_REQUESTED"],
  CHANGES_REQUESTED: ["LECTURES_IN_PROGRESS", "READY_TO_PUBLISH", "SUBMITTED", "UNDER_REVIEW", "ARCHIVED"],
  REJECTED: ["DRAFT", "SUBMITTED", "ARCHIVED"],
  APPROVED: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function canTransition(from: ChapterStatusValue, to: ChapterStatusValue): boolean {
  if (from === to) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextValidStates(from: ChapterStatusValue): ChapterStatusValue[] {
  return TRANSITIONS[from] ?? [];
}
