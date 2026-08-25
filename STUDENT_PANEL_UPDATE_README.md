# Student Panel Redesign — Update Package

This package rebuilds the **student-facing portal** (`src/app/(student)/*`) as real,
DB-wired Next.js pages, replacing the old inline-nav layout with a unified shell
and adding two new sections (Doubt Portal, ID Card) that didn't exist before.

It converts the merged 13-screen student-panel mockup (`student-panel-final.html`,
delivered earlier) into production code — using your project's **real design
tokens** (`glass-card`, `stack-*`, `gutter`, MD3 color roles, `font-*`/`text-*`
pairs) and **real Prisma models**, not the mockup's own placeholder styling or
fabricated data.

## What's in this package

```
middleware.ts                                          (updated)
src/app/(student)/layout.tsx                            (updated — new shell)
src/app/(student)/dashboard/page.tsx                     new
src/app/(student)/courses/page.tsx                       new
src/app/(student)/courses/[batchId]/page.tsx              new
src/app/(student)/courses/[batchId]/subjects/[subjectId]/page.tsx  new
src/app/(student)/live-class/page.tsx                     new
src/app/(student)/doubts/page.tsx                         new
src/app/(student)/doubts/[id]/page.tsx                    new
src/app/(student)/id-card/page.tsx                        new
src/app/(student)/settings/page.tsx                       new
src/components/student/StudentShell.tsx                  new
src/components/student/NextClassCountdown.tsx             new
src/components/student/DoubtSubmitForm.tsx                new
src/app/api/doubts/route.ts                               new
src/app/api/doubts/[id]/route.ts                          new
src/lib/validation/doubt.ts                               new
```

## Apply steps

1. Copy every file above into the matching path in your real project,
   overwriting `middleware.ts` and `src/app/(student)/layout.tsx`.
2. No new dependencies — everything used here (`next-auth`, `zod`, Prisma,
   Tailwind) is already in your `package.json`. No `npm install` needed.
3. No schema changes — every page/route queries models that already exist
   (`Doubt`, `Student`, `Batch`, `BatchEnrollment`, `BatchSchedule`, `Subject`,
   `Chapter`). No migration needed.
4. Run `npm run typecheck` and `npm run dev`, then sanity-check as a logged-in
   student: Dashboard → My Batches → a batch detail → a subject → Doubts →
   ID Card → Settings.

## New shell (`StudentShell.tsx`)

Replaces the old inline nav in `(student)/layout.tsx` with a responsive shell
matching the merged mockup: a fixed sidebar on desktop, a 5-item bottom nav +
"More" drawer on mobile (11 total nav destinations don't fit a bottom bar, so
the 6 less-frequent ones — Live Classes, Doubts, ID Card, Settings, etc. — live
behind "More", the same pattern Unacademy's own app uses). `layout.tsx` now
calls `requireStudentSession()` once and passes `studentName`/`studentIdCode`
down, instead of every page re-fetching that.

`middleware.ts`: added `/live-class` and `/settings` to `STUDENT_PATHS` and
`config.matcher`. `/live-class` pages already existed in another unmerged
package but were never added to the edge-protection list — a real gap this
update closes. `/settings` is new in this update.

## What changed from the mockup, and why

The mockup had several elements with no backing data model. Rather than ship
fake UI for them, each was either dropped or replaced with a real equivalent:

| Mockup element | What ships instead | Why |
|---|---|---|
| Streak counter / gamification badges | — (dropped) | No streak/points model in the schema. |
| "Continue Learning" video progress card | "My Batches" quick list on the dashboard | No `Lecture`/video-progress model — `WhiteboardSession` schema comment explicitly defers video content to Course Engine/Phase 3. |
| Notice Board / announcements | "Recent Doubts" widget | No `Announcement`/`Notice` model. Recent doubts is real data that fits the same dashboard slot. |
| Doubt photo attachment | Disabled dropzone with a "coming soon" tooltip | `Doubt` has no attachment field. Kept visible (not deleted) since it's clearly a near-term addition, but honestly disabled rather than faked. |
| Doubt thumbs-up/down feedback | — (dropped) | No feedback field on `Doubt`. |
| "Chat with Mentor" | — (dropped) | No mentor-chat model or relation anywhere in the schema. |
| Chapter video player | Chapter list with question counts + an info banner | Same "no Lecture model yet" limitation — mirrors the honest banner already used on the real `schedule/page.tsx` for a similar gap. |

## Doubt Portal (new)

`/doubts` — submit form (`DoubtSubmitForm.tsx`, client component) + a
server-rendered list of the student's own doubts, ownership-scoped via
`studentId` (same pattern as `/api/batches/my`, not RBAC — this is a basic
student action). `/doubts/[id]` shows the full thread: the student's question,
and once `status = RESOLVED`, the `expertExplanation`/`videoUrl`/`resolvedBy`.
Status badges map the real `DoubtStatus` enum: `OPEN` → "Pending", `RESOLVED`
→ "Resolved", `FLAGGED` → "Flagged for Review".

`POST /api/doubts` validates with `doubtCreateSchema` (subject is one of a
fixed dropdown list — `Doubt.subject` is free-text in the schema, but a fixed
list keeps it filterable/reportable later, same convention as
`SUBJECT_EXPERTISE_OPTIONS` in `validation/teacher.ts`).

## ID Card (new)

`/id-card` — real `Student` fields (`studentIdCode`, `enrollmentNumber`,
`class`, `targetExam`, `school`, `city`/`state`, `qrCodeUrl`) plus three real
counts (active batches, doubts asked, doubts resolved). Photo/QR code render
via a plain `<img>` (not `next/image`) since those URLs are user-uploaded /
externally hosted and your `next.config.js` remote-image allowlist wasn't in
the snapshot this update was built against — swap to `next/image` once you've
confirmed those domains are allowlisted, for the usual optimization benefits.

## Settings (new, deliberately minimal)

Read-only account info (name, email, student ID, enrollment number) + sign
out. The mockup had toggles for notifications/theme/language — none are
backed by a schema field, so rather than ship controls that don't persist
anything, this page only shows what's real. Extend it once there's a
`StudentPreferences`-style model to write to.

## Known limitations / depends on other packages

- **Live Classes** (`/live-class`) lists real `BatchSchedule` rows of type
  `LIVE_CLASS`, correctly split into Live Now / Upcoming / Recently Ended.
  Clicking through goes to `/live-class/[scheduleId]`, which is **not** part
  of this package — it's the real whiteboard classroom built in the
  `atomic-ops-live-whiteboard` / `atomic-ops-tests-video` packages. If those
  aren't merged yet, that link 404s; the listing page itself works standalone.
- **Schedule**: this package doesn't touch `/schedule` — the real DB-wired
  version already exists from the `atomic-ops-batch-update` package. If you
  haven't merged that one yet, `/schedule` will still be the old static mock,
  which is inconsistent with the rest of this update (which assumes real
  batch data) but not broken by it.
- **Chapter content**: subject/chapter pages show question-bank counts only,
  by design (see table above) — this is not a bug to fix later without a
  Lecture/video model.

## Verification

New/changed files were type-checked with a hand-built `tsc --noEmit` harness
(a real `@prisma/client` couldn't be generated in the sandbox this was built
in — `binaries.prisma.sh` was unreachable — so the harness used a stub client
typed by hand from every field/relation/enum actually used, transcribed
directly from `schema.prisma`). All files in this package compile clean.
Run `npm run typecheck` in your real project as a final check, since it has
the real generated client — but every model/field/enum used here (`Doubt`,
`Student`, `Batch`, `BatchEnrollment`, `BatchSchedule`, `BatchTeacher`,
`Subject`, `Chapter`, `Course`) was cross-checked line-by-line against
`schema.prisma` regardless.
