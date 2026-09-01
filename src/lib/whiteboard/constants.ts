// Shared between server (lifecycle.ts, access.ts) and client
// (TeacherLiveClassRoom.tsx) — no "server-only" guard here on purpose, so
// the client's own countdown/warning timer stays in lock-step with the
// backend's auto-end grace window instead of duplicating the literal.

// How long a live class is allowed to run past its scheduled `endsAt`
// before the backend force-ends it. Generous enough that a class quickly
// wrapping up isn't cut off mid-sentence, short enough that a class the
// teacher genuinely forgot to end doesn't run indefinitely.
export const GRACE_PERIOD_MINUTES = 10;

// How far before `endsAt` the teacher-only "wrap up soon" warning appears.
export const END_WARNING_MINUTES = 5;
