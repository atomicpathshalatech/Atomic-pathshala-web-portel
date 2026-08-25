# Live Whiteboard Update — Hand Raise + Quick Quiz

This package adds a **live teaching session** to Atomic Pathshala: a teacher-run
whiteboard bound to a scheduled Live Class, with real-time **hand raise** and
**quick quiz** built on top of it. It's an incremental update on top of the
**Batch System** package delivered earlier — apply that one first if you
haven't already (`whiteboard_sessions` has a required foreign key to
`batch_schedules`, which only exists after that migration runs).

## What this actually is (read before demoing it)

This is **Phase 1–2 only** of the bigger whiteboard spec you shared — the
canvas engine, session/page lifecycle, hand raise, and quick quiz. It is
**not**:

- video/audio streaming, screen share, or camera tiles
- the board's drawn content mirrored live to students — **students do not
  see what the teacher draws in this build**. They get real-time hand-raise
  and quiz tools on the same schedule entry, not a synced canvas.
- PDF/NCERT background import, equation editor, or subject-specific tools
- recording/playback, AI features, or anything from "Phase 5/6" of your spec

That last point is the one most likely to surprise someone testing this —
it's a deliberate scope cut, not a bug, and both the teacher and student UIs
say so explicitly on screen. Mirroring the canvas to students needs either a
video pipeline (LiveKit/Agora-style) or streaming every stroke to every
viewer at 60fps, both of which are real infrastructure decisions beyond
"add a realtime library" — worth a separate conversation before building.

## Why Pusher, why BatchSchedule, why not `ws`

Your draft used a raw `ws` server + a `Lecture` entity. Neither exists
cleanly in this codebase yet:

- The project runs plain `next dev` / `next start` — there's no custom HTTP
  server to attach a `ws.Server` to without changing how the whole app
  deploys. Pusher is a hosted pub/sub service reached over HTTPS from a
  normal Next.js API route, so it drops in with zero deployment changes —
  same reasoning as this project's existing use of Neon and Razorpay as
  managed services instead of self-hosted ones.
- There's no `Lecture` model — Course Engine (Phase 3 in your own build
  order) hasn't been built yet. The closest real, already-existing concept
  is `BatchSchedule` (from the Batch System update), so `WhiteboardSession`
  binds to that instead. When a real `Lecture` model exists later, add
  `lectureId` alongside/instead of `batchScheduleId` — it's called out in a
  comment above the `WhiteboardSession` model in `schema.prisma`.

## New Prisma models

- `WhiteboardSession` — one per `BatchSchedule` (`@unique` on
  `batchScheduleId`), owned by the `Teacher` who started it.
- `WhiteboardPage` — one canvas page's vector stroke data (`objects: Json`),
  child of a session.
- `QuizSession` / `QuizResponse` — a launched quiz/poll and each student's
  answer (server-computed `isCorrect`, never client-supplied).
- `HandRaiseEvent` — one row per raise, `PENDING` → `RESOLVED`.

Migration: `prisma/migrations/20260819090000_add_live_whiteboard/`.

## Realtime channels (Pusher)

- `presence-wb-session-{id}` — everyone in the session (teacher + viewing
  students). Used for the "N watching" roster count and session-ended
  notices.
- `private-wb-teacher-{id}` — **teacher only**. Hand-raise queue and live
  quiz vote counts. Never sent to students — that would leak who raised a
  hand before the teacher sees it, or leak vote counts before reveal.

Both are authorized by `src/app/api/pusher/auth/route.ts`, which re-derives
identity from the signed-in server session every time — it never trusts a
client-supplied user id, name, or role (the thing your draft's `ws` server
did via URL query params, which was a real security gap).

## New/changed files

**New:**
- `src/lib/realtime/events.ts`, `pusher-client.ts`, `pusher-server.ts`
- `src/lib/canvas/canvas-engine.ts` — the vector canvas engine (dual-canvas,
  pen/highlighter/eraser/select, undo/redo). See the header comment in that
  file for the performance rationale.
- `src/lib/whiteboard/access.ts` — the one function every route and the
  Pusher authorizer uses to decide "can this user see/act on this session"
- `src/lib/whiteboard/hand-raise.ts`, `quiz.ts` — shared realtime-push helpers
- `src/lib/validation/whiteboard.ts` — Zod schemas
- `src/app/api/pusher/auth/route.ts`
- `src/app/api/whiteboard/sessions/**` — full session/page/hand-raise/quiz API
- `src/app/(team)/team/live-class/[scheduleId]/page.tsx` +
  `src/components/live-class/TeacherLiveClassRoom.tsx`
- `src/app/(student)/live-class/[scheduleId]/page.tsx` +
  `src/components/live-class/StudentLiveClassRoom.tsx`

**Changed:**
- `prisma/schema.prisma` — new models/enums + relation fields on
  `Student`/`Teacher`/`BatchSchedule`
- `package.json` — added `pusher`, `pusher-js`
- `.env.example` — added `PUSHER_*` / `NEXT_PUBLIC_PUSHER_*` vars
- `src/app/(team)/team/batches/[id]/page.tsx`,
  `src/components/team-portal/BatchScheduleManager.tsx` — added a working
  "Start Live Class" link on `LIVE_CLASS` schedule entries
- `src/app/(student)/schedule/page.tsx` — the "Join Class" button now
  actually works when a class is live (it was a disabled placeholder
  before); "Remind Me" for not-yet-live classes stays honestly disabled,
  since reminders aren't built

## Apply steps

1. Merge this package's files into your project (same as the Batch System
   package — copy over the matching folders, don't skip `prisma/schema.prisma`,
   it's additive to what's already there).
2. `npm install` (pulls in `pusher` + `pusher-js`).
3. Get free Pusher **Channels** app credentials at dashboard.pusher.com and
   fill in `.env`: `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`,
   `PUSHER_CLUSTER`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`.
4. **Make sure the Batch System migration succeeded first** — if
   `npx prisma migrate status` still shows `add_batch_system` as pending (the
   `P1001`/"table batches does not exist" error from before), fix that
   before continuing; this update's migration has a hard foreign-key
   dependency on `batch_schedules`.
5. `npx prisma generate && npx prisma migrate dev` — applies
   `add_live_whiteboard`.
6. `npm run dev`, sign in as a teacher assigned to a batch with a
   `LIVE_CLASS` schedule entry happening now or soon, go to
   `/team/batches/{id}` → **Start Live Class**.
7. In another browser/incognito window, sign in as a student enrolled in
   that batch, go to `/schedule` → **Join Class** once the entry shows
   "Live Now".

## Known limitations / deliberate cuts

- **One active quiz at a time per session** — launching a new one auto-closes
  whatever was still open.
- **Autosave is debounced (~1.5s) and not audit-logged** — logging every
  stroke-batch or page-flip would flood the audit log for no real
  accountability benefit; only session start/resume/end and quiz
  launch/reveal are logged (see the comments in the relevant route files
  for the reasoning).
- **50-page cap per session, 5000-object cap per page** — sanity limits, not
  expected to bind in a real class; raise them in
  `src/app/api/whiteboard/sessions/[id]/pages/route.ts` /
  `src/lib/validation/whiteboard.ts` if needed.
- **No page content is ever sent to students** — enforced at the API layer
  (`GET /api/whiteboard/sessions/[id]` returns a different, page-less shape
  for the `STUDENT` role), not just hidden in the UI.
- **Ending a class also auto-resolves any pending hand raises and closes any
  open quiz** — so nothing is left "live" after the teacher walks away.
