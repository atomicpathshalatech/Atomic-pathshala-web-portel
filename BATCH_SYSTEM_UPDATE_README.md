# Atomic Pathshala — Update Package (Batch System)

This zip contains **only new/changed files** — copy them into your existing
`atomic-ops` project, overwriting where prompted. Do NOT extract this over
`node_modules` or delete anything else in your project.

## Why this update

The project audit found no first-class `Batch` entity anywhere in the
codebase — "batches" only existed as marketing copy on the landing page.
Every future piece of the platform (Course Engine, Live Classes, Test
Engine, Subscriptions-to-content gating) needs students grouped into a
batch, under one or more teachers, with a real timetable. This update adds
that foundation.

## What's new

- **`Batch` model** — name, unique code, optional linked `Course`, target
  exam, status (`UPCOMING` / `ACTIVE` / `COMPLETED` / `ARCHIVED`), optional
  start/end dates and capacity.
- **`BatchTeacher`** — assigns one or more Teachers to a Batch, optionally
  scoped to a subject (so a batch can have a separate Physics/Chemistry/Bio
  teacher).
- **`BatchEnrollment`** — links Students to a Batch with a status
  (`ACTIVE` / `COMPLETED` / `DROPPED`), who enrolled them, and when. Capacity
  is enforced at enrollment time if the batch has one set.
- **`BatchSchedule`** — the actual timetable: one row per class/test/DPP/
  doubt session, with a type, status (`SCHEDULED` / `LIVE` / `COMPLETED` /
  `CANCELLED`), optional teacher, start/end time, and notes.
- **Team Portal UI** (`/team/batches`): list, create, edit, and a detail
  page per batch with three management panels — assign/remove teachers,
  enroll/drop/remove students (with search), and add/edit/delete timetable
  entries. Gated by six new RBAC permissions (see below), matching every
  other module in this codebase (`hasPermission()`, never inline role
  checks).
- **Student Portal** (`/schedule`): the page that used to hardcode a fake
  October calendar and invented class names now shows the signed-in
  student's **real** enrolled batch, its faculty, and its actual upcoming/past
  timetable — with an honest empty state ("You're not enrolled in a batch
  yet") if they aren't enrolled in anything, instead of fabricated data.
- **Student-facing API** (`GET /api/batches/my`) — a student's own batch +
  schedule, ownership-checked against their own Student record (same
  pattern as `/api/doubts`, not an RBAC permission).

## New permissions

Added to `src/lib/rbac/permissions.ts`:

| Code | Meaning | Granted by default to |
|---|---|---|
| `batch.read` | View batches and their detail | Teacher, Academic Head, Department Head |
| `batch.create` | Create a batch | Academic Head |
| `batch.update` | Edit a batch + assign/remove teachers | Academic Head |
| `batch.delete` | Delete a batch | Academic Head |
| `batch.enrollment.manage` | Enroll/drop/remove students | Academic Head |
| `batch.schedule.manage` | Add/edit/delete timetable entries | Academic Head |

`SUPER_ADMIN` / `FOUNDER` get everything automatically, as with every other
permission in this project. Adjust the defaults in
`ROLE_PERMISSION_DEFAULTS` if you want, say, Sales/Support to also read
batches for CRM purposes — nothing here is hardcoded.

## New files

```
prisma/migrations/20260817120000_add_batch_system/migration.sql
src/lib/validation/batch.ts
src/app/api/team/batches/route.ts
src/app/api/team/batches/[id]/route.ts
src/app/api/team/batches/[id]/teachers/route.ts
src/app/api/team/batches/[id]/teachers/[teacherId]/route.ts
src/app/api/team/batches/[id]/students/route.ts
src/app/api/team/batches/[id]/students/[studentId]/route.ts
src/app/api/team/batches/[id]/schedule/route.ts
src/app/api/team/batches/[id]/schedule/[scheduleId]/route.ts
src/app/api/batches/my/route.ts
src/app/(team)/team/batches/page.tsx
src/app/(team)/team/batches/new/page.tsx
src/app/(team)/team/batches/[id]/page.tsx
src/app/(team)/team/batches/[id]/edit/page.tsx
src/components/team-portal/BatchForm.tsx
src/components/team-portal/BatchTeacherManager.tsx
src/components/team-portal/BatchEnrollmentManager.tsx
src/components/team-portal/BatchScheduleManager.tsx
```

## Changed files

- `prisma/schema.prisma` — adds `Batch`, `BatchTeacher`, `BatchEnrollment`,
  `BatchSchedule` models + `BatchStatus` / `BatchEnrollmentStatus` /
  `ScheduleSessionType` / `ScheduleSessionStatus` enums, plus relation
  fields on `Student` (`batchEnrollments`), `Teacher` (`batchAssignments`,
  `scheduleSessions`), and `Course` (`batches`).
- `src/lib/rbac/permissions.ts` — the six permissions above.
- `src/app/(team)/team/layout.tsx` — "Batches" nav link added.
- `src/app/(team)/team/page.tsx` — "Batches" module card added (marked
  available, since unlike Coupons/CRM/Finance this one is now real).
- `src/app/(student)/schedule/page.tsx` — full rewrite, real data instead
  of the sample October calendar.

`prisma/seed.ts` does **not** need any changes — it already loops over
`PERMISSIONS` and `ROLE_PERMISSION_DEFAULTS` generically, so re-running it
picks up the new permission codes automatically.

## How to apply

```bash
# 1. Copy the files from this zip into your project root, overwriting
#    prisma/schema.prisma, src/lib/rbac/permissions.ts,
#    src/app/(team)/team/layout.tsx, src/app/(team)/team/page.tsx,
#    src/app/(student)/schedule/page.tsx, and adding everything else new.

# 2. Regenerate the Prisma client and run the migration
npx prisma generate
npx prisma migrate dev --name add_batch_system

# 3. Re-seed (adds the new permission codes to existing roles — safe to
#    re-run, it's upsert-based, won't duplicate or wipe anything)
npm run db:seed

# 4. Start the app
npm run dev
```

*(I wasn't able to run `prisma generate` / `prisma migrate dev` / `npm
install` here — no live connection to your database from this environment
— so please run steps 2–3 on your machine and let me know if anything
errors. The migration SQL was hand-written to exactly match what
`schema.prisma` describes and follows the same enum/table/index/foreign-key
shape Prisma itself generated for your existing migrations, but it's worth
double-checking `prisma migrate status` afterward.)*

## Notes / things to sanity-check on your machine

- **A student can only be enrolled in one batch at a time in the UI** —
  the schema technically allows multiple active `BatchEnrollment` rows per
  student (no such constraint), and `/schedule` picks the most recently
  enrolled one if there happens to be more than one. If your model is
  strictly one-batch-per-student, consider adding a partial unique index
  (`studentId` where `status = 'ACTIVE'`) later — left out for now since
  Prisma doesn't support partial unique indexes without a raw SQL migration
  tweak, and it wasn't clear you need multi-batch support ruled out yet.
- **Capacity is a soft rule** — enforced only at enrollment time; it doesn't
  retroactively block anything if you lower a batch's capacity below its
  current headcount.
- **Every write is audit-logged** (`BATCH_CREATED`, `BATCH_TEACHER_ASSIGNED`,
  `BATCH_STUDENT_ENROLLED`, `BATCH_SCHEDULE_CREATED`, etc.), matching the
  rest of this codebase's audit policy.
- **The "Join Class" button on `/schedule` is intentionally disabled** with
  a tooltip explaining live streaming isn't wired up. This update only
  builds the *timetable* — it deliberately does not fake a live-class
  experience. Wiring an actual live-video provider (LiveKit / Agora / 100ms)
  and a real-time whiteboard sync layer against `BatchSchedule` rows with
  `type = LIVE_CLASS` is the natural next phase.
- **`/team/batches/[id]`'s student search fetches up to 500 students**
  client-side for the enroll search box — fine for the scale a coaching
  institute usually has in one shot, but if you cross a few thousand
  students, swap it for a debounced server-side search API instead of
  raising the cap.
- Course linking is optional on purpose — you can create and run a batch
  before the Course Engine (Phase 3) exists, and link it to a `Course`
  later once that module ships.
