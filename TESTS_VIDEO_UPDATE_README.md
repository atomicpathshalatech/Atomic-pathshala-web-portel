# Test/Quiz Engine + Live Video Calling + Board Mirroring

This package adds three things on top of the **Batch System** and **Live
Whiteboard** updates delivered earlier — apply both of those first (this
migration has a hard foreign-key dependency on `batch_schedules`, and the
video/board-mirroring changes edit files from the whiteboard package):

1. **Test/Quiz Engine** — proper timed mock tests assembled from the
   Question Bank, delivered through a batch's timetable, server-scored.
2. **Full two-way video calling** in the live class room — teacher and
   student camera + mic, both directions.
3. **Board live-mirroring** — the whiteboard drawing the teacher does now
   actually shows up on the student's screen in near-real-time. This was the
   explicit, documented cut in the Live Whiteboard package; it's built now
   because a real "live class" needs it alongside video.

## Test/Quiz Engine

### Data model

- `Test` — one per `BatchSchedule` (`@unique` on `batchScheduleId`, same
  1:1-with-a-timetable-slot pattern as `WhiteboardSession`). Uses the
  `TEST` value of `ScheduleSessionType`, which already existed in the enum
  but had nothing wired to it — this is that missing piece.
- `TestQuestion` — join row pinning a Question Bank question to a test at a
  given order. Only `VERIFIED`-status questions can be added.
- `TestAttempt` — one per (test, student), enforced by a DB unique
  constraint — a student gets exactly one attempt.
- `TestAttemptAnswer` — one row per question the student answered,
  server-computed `isCorrect`/`marksAwarded` — never trusts a client-supplied
  "I got this right."

`totalMarks` is deliberately **not** stored on `Test` — it's computed on
read as `sum(question.marksCorrect)` across the test's questions, so it can
never go stale if a question is added/removed after creation.

Migration: `prisma/migrations/20260821100000_add_test_engine/`.

### Server-side timing (read this before you assume a client bug)

A test's real deadline is `min(attempt.startedAt + test.durationMin, schedule.endsAt)`
— computed server-side on every request that matters (autosave, submit, and
the "my attempt" GET). The client-side countdown is display-only. Two
consequences:

- A student who starts 2 minutes before the schedule slot closes does **not**
  get the full duration — same as a real exam hall.
- **Lazy auto-finalize**: if a student closes the tab instead of clicking
  Submit, nothing scores their attempt until *something* asks about it again
  — there's no cron job. The very next time `GET .../attempts/my` is called
  (by that student re-opening the page, or by anyone), if the deadline has
  quietly passed it gets scored right there as `AUTO_SUBMITTED` before
  responding. If a student never comes back and nobody else ever queries
  their specific attempt, it can sit `IN_PROGRESS` indefinitely — the
  Results page only lists `SUBMITTED`/`AUTO_SUBMITTED` attempts, so an
  abandoned one just won't appear until it's touched. If you need every
  attempt finalized promptly regardless of anyone visiting, add a scheduled
  sweep that calls `finalizeAttempt` for expired `IN_PROGRESS` rows — the
  function is already isolated in `src/lib/test-engine/scoring.ts` for
  exactly that.

### Question Bank integration — please read this one

The uploaded project mirror we had access to while building this **did not
include a Question Bank API route** (only a couple of unrelated student/team
routes existed in what we could see), even though the Question Bank itself
is clearly fully built per your project's schema (`Question`, `Subject`,
`Chapter`, `QUESTION_VERIFY` permission, etc.). We could not verify your
real Question Bank endpoint's path or response shape, so
`src/app/api/team/question-bank/route.ts` is a **new, minimal, read-only**
search endpoint (verified questions only, search by body text) built
specifically to feed the test question-picker UI.

**If you already have a real Question Bank list/search API**, point
`TestQuestionPicker.tsx`'s fetch call at it instead and delete this stand-in
— search for the comment marked `TODO` at the top of that route file.

### RBAC

New permissions: `TEST_READ`, `TEST_CREATE`, `TEST_UPDATE`, `TEST_PUBLISH`,
`TEST_DELETE`. Teachers get read/create/update (can build and edit drafts);
only `ACADEMIC_HEAD` gets publish/delete — a second pair of eyes gates a
test going live, same reasoning as `QUESTION_VERIFY` being separate from
`QUESTION_CREATE`.

### New routes

- Team: `src/app/api/team/tests/**` — CRUD, add/remove questions, publish,
  results (ranked by score).
- Student: `src/app/api/tests/**` — list published tests for your batches,
  start/resume an attempt, autosave an answer, submit, view your result.
- UI: `/team/tests`, `/team/tests/new`, `/team/tests/[id]` (team); `/tests`,
  `/tests/[id]/attempt`, `/tests/[id]/result` (student — this replaces the
  "Coming Soon" test series placeholder your nav already links to).

## Video calling (LiveKit)

Full two-way camera + mic, both teacher and student — not a one-way
broadcast. Built the same way this project already handles Neon, Razorpay,
and Pusher: a **managed service** reached over the network, not something
self-hosted, so it drops into `next dev`/`next start` with zero deployment
changes.

- One LiveKit **room** per live class = one `WhiteboardSession` id
  (`wb-session-{sessionId}`) — video, whiteboard, hand-raise, and quiz all
  key off the same session, so video starts/stops with the class the same
  way everything else does.
- `GET /api/whiteboard/sessions/[id]/video-token` mints a short-lived
  join token, gated the same way every other whiteboard route is
  (`resolveWhiteboardAccess`) plus a check that the session is `ACTIVE`.
  Both roles get identical grants (full publish + subscribe) — this is a
  genuine two-way call, not a teacher-only broadcast.
- The UI is a **compact strip**, not a full-screen call — small tiles next
  to the whiteboard (`src/components/live-class/VideoStrip.tsx`), built on
  `@livekit/components-react`'s hooks/primitives rather than its prefab
  `<VideoConference>` layout, specifically so it could stay small. Each side
  gets a mic/camera mute toggle.
- **Fails soft everywhere.** If `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` /
  `NEXT_PUBLIC_LIVEKIT_URL` aren't set, the token route returns 503 and the
  strip shows "Video call unavailable" instead of breaking the page — the
  whiteboard, hand raise, and quiz all keep working with zero video
  configuration. You can ship this update and wire up LiveKit credentials
  whenever you're ready, not before.

### Getting LiveKit credentials

1. Sign up free at [cloud.livekit.io](https://cloud.livekit.io) (no card
   required for the free tier — enough participant-minutes to pilot).
2. Create a project.
3. Settings → Keys → generate a key pair. You get an API Key, an API
   Secret, and your project's WebSocket URL (`wss://<project>.livekit.cloud`).
4. Put those in `.env` as `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
   `NEXT_PUBLIC_LIVEKIT_URL`.

## Board mirroring

The Live Whiteboard package's README said, explicitly: *"the board's drawn
content mirrored live to students... needs either a video pipeline
(LiveKit/Agora-style) or streaming every stroke to every viewer at 60fps...
worth a separate conversation before building."* That conversation happened
— this is that pipeline, and it reuses the Pusher channel already open for
hand-raise/quiz rather than piggybacking on the new LiveKit connection
(strokes are structured JSON, not video, so they don't belong on a media
transport).

**Design: broadcast a signal, not the strokes.** Exactly like
`pushHandRaiseQueue` already does — Postgres is the source of truth, Pusher
just says "something changed, go re-fetch":

- Teacher autosave (`PATCH .../pages/[pageId]`) and page-switch
  (`PATCH .../sessions/[id]`) now also fire `board-updated` /
  `page-changed` on the existing session channel — small payloads
  (`{pageNumber}`), never the stroke data itself. A raw page of ink easily
  exceeds Pusher's ~10KB message cap; this design never risks that.
- A new endpoint, `GET .../sessions/[id]/board`, is the **only** place a
  student ever receives `objects` (stroke data) — and only ever for the
  single page the teacher currently has open. No page history, no "let me
  flip ahead" — a student sees what the teacher is showing right now,
  exactly like the quiz tools already work.
- The student component re-fetches `.../board` whenever it hears either
  event, and renders it on a **second, read-only** `CanvasEngine` instance
  (`canvas-engine.ts` gained an `options.readOnly` flag — when set, it never
  attaches pointer listeners, so a student can't accidentally draw on their
  own mirror and mistake it for something reaching the teacher).

This is near-real-time, not frame-perfect: strokes still batch through the
existing ~1.5s autosave debounce before they're visible to students, same
as they always did for the teacher's own reload-recovery. Making it
per-stroke-live would mean broadcasting on every pointer commit instead of
on debounced save, which is a bigger, separate change from "mirror what
autosave already persists."

## New/changed files

**New:**
- `src/lib/test-engine/*`, `src/lib/validation/test.ts`
- `src/lib/batch/access.ts` (moved out of `whiteboard/access.ts`, which now
  re-exports it — the Test Engine needed the exact same ownership checks,
  one implementation instead of two)
- `src/app/api/team/tests/**`, `src/app/api/team/question-bank/route.ts`
  (see the caveat above), `src/app/api/tests/**`
- `src/components/team-portal/TestForm.tsx`, `TestQuestionPicker.tsx`,
  `PublishTestButton.tsx`
- `src/components/student/TestAttemptRunner.tsx`
- `src/app/(team)/team/tests/**`, `src/app/(student)/tests/**`
- `src/lib/livekit/server.ts`, `src/app/api/whiteboard/sessions/[id]/video-token/route.ts`
- `src/components/live-class/VideoStrip.tsx`
- `src/app/api/whiteboard/sessions/[id]/board/route.ts`,
  `src/lib/whiteboard/board-mirror.ts`
- `prisma/migrations/20260821100000_add_test_engine/`

**Changed:**
- `prisma/schema.prisma` — `Test`/`TestQuestion`/`TestAttempt`/
  `TestAttemptAnswer` models + `TestStatus`/`TestAttemptStatus` enums
- `src/lib/rbac/permissions.ts` — `TEST_*` permissions
- `src/lib/whiteboard/access.ts` — re-exports the two ownership helpers from
  `batch/access.ts` instead of defining them locally (existing imports
  elsewhere are unaffected)
- `src/lib/canvas/canvas-engine.ts` — added the `readOnly` constructor option
- `src/lib/realtime/events.ts` — added `BOARD_UPDATED`/`PAGE_CHANGED` events
- `src/app/api/whiteboard/sessions/[id]/pages/[pageId]/route.ts` — broadcasts
  `board-updated` after a save that touches the currently-active page
- `src/app/api/whiteboard/sessions/[id]/route.ts` — broadcasts
  `page-changed` on an active-page switch
- `src/components/live-class/TeacherLiveClassRoom.tsx` — added `<VideoStrip>`
  to the header
- `src/components/live-class/StudentLiveClassRoom.tsx` — added
  `<VideoStrip>` and the read-only board-mirror canvas, replaced the old
  "board isn't mirrored" notice
- `package.json` — added `livekit-server-sdk`, `livekit-client`,
  `@livekit/components-react`
- `.env.example` — added `LIVEKIT_*` / `NEXT_PUBLIC_LIVEKIT_URL`

## Apply steps

1. Merge this package's files into your project (same as the previous two
   packages — copy over the matching folders; don't skip `prisma/schema.prisma`,
   it's additive).
2. **Make sure the Batch System and Live Whiteboard migrations already
   applied** — `npx prisma migrate status` should show only
   `add_test_engine` as pending before you continue.
3. `npm install` (pulls in the three LiveKit packages).
4. `npx prisma generate && npx prisma migrate dev` — applies
   `add_test_engine`.
5. (Optional but needed for video) Get LiveKit credentials — see above —
   and add them to `.env`. Skip this and everything else still works; the
   video strip just shows "unavailable."
6. If you have a real Question Bank API, swap it into
   `TestQuestionPicker.tsx` in place of the stand-in — see the caveat above.
7. `npm run dev`. As a teacher with `TEST_CREATE`, add a **Test**-type
   timetable slot on a batch (Batch → Timetable → type: Test), then
   `/team/tests/new` to build a draft, add questions, and (as
   `ACADEMIC_HEAD`) Publish. As a student enrolled in that batch, `/tests`
   shows it once published and the window opens.
8. For video + board mirroring: start a live class as usual
   (`/team/batches/{id}` → Start Live Class); a student joining via
   `/schedule` → Join Class now sees the teacher's camera/mic strip and the
   live-mirrored board, and can toggle their own camera/mic.

## Known limitations / deliberate cuts

- **No screen share** — camera/mic only. LiveKit supports screen share; it
  wasn't asked for and would need its own compact-UI treatment.
  `Track.Source.ScreenShare` is the hook to add it later.
- **No recording.** Neither the video call nor the board is recorded/played
  back.
- **Board mirroring follows the teacher's autosave cadence (~1.5s debounce),
  not per-stroke** — see the design note above for why.
- **Abandoned test attempts only score when something asks about them again**
  — see the Server-side timing note above if you need a scheduled sweep.
- **The Question Bank search endpoint is a stand-in** — see the caveat
  above; replace it if you already have a real one.
