# Reconciliation Patch — fixes the Doubt Portal / ID Card conflict

Your `tsc --noEmit` run surfaced a real problem: the snapshot I originally built the
Student Panel update from was out of date, and it didn't include a Doubt Portal
that **already existed and worked** in your real project
(`src/components/student-portal/DoubtForm.tsx`, the resolve route at
`src/app/api/team/doubts/[id]/resolve/route.ts`, and a working QR generator used
by the old ID card page). My update overwrote the shared `validation/doubt.ts`
file and duplicated the doubt form and ID card page, which broke the team-side
resolve route and dropped the QR code / avatar-initials behavior.

This patch replaces exactly 3 files with reconciled versions, and asks you to
delete 1 file that's now dead code. Nothing else from the original
`atomic-ops-student-panel-update.zip` needs to change.

## Apply steps

1. **Delete** this file (it's now unused — replaced by reusing the existing
   `DoubtForm.tsx`):
   ```
   src/components/student/DoubtSubmitForm.tsx
   ```
2. **Overwrite** these 3 files with the versions in this patch:
   ```
   src/lib/validation/doubt.ts
   src/app/(student)/doubts/page.tsx
   src/app/(student)/id-card/page.tsx
   ```
3. Run `npx tsc --noEmit` again — the two doubt-related errors
   (`doubtResolveSchema` missing, `SUBJECT_OPTIONS` missing) should be gone.

## What changed in each file

**`src/lib/validation/doubt.ts`** — restored to the original shape
(`SUBJECT_OPTIONS`, `doubtCreateSchema`, `doubtResolveSchema` all present
again, exactly as the team resolve route and `DoubtForm.tsx` expect), with one
additive change: `doubtCreateSchema` now has an optional `priority` field
(`.default("NORMAL")`). This is backward-compatible — `DoubtForm.tsx` never
sends `priority`, so it silently defaults to `NORMAL` exactly as before this
field existed. Also restored `.max(2000, ...)` on `body` as a sane cap.

**`src/app/(student)/doubts/page.tsx`** — now imports and renders the
existing `<DoubtForm />` from `@/components/student-portal/DoubtForm` instead
of the duplicate form I'd built. Kept the two genuine improvements from my
version: the two-column layout, and each doubt row now links to
`/doubts/[id]` (a real new detail page — the old page didn't have one, it
just inline-expanded resolved doubts).

**`src/app/(student)/id-card/page.tsx`** — restored the original QR code
generation via `generateStudentQrDataUrl(student.studentIdCode)` from
`@/lib/utils/qr` (I'd incorrectly switched to reading `student.qrCodeUrl`
directly, a field that's likely `null` for most students since nothing sets
it) and the initials-avatar fallback for students without a `photoUrl`. Kept
the 3 new stat tiles (Active Batches / Doubts Asked / Doubts Resolved), which
are a genuine addition — the original page didn't have them.

## Why this happened

The project snapshot I was given to build the original Student Panel update
didn't include several files that already existed in your real repo — not
just the Doubt Portal, but also work from other update packages you'd
already applied locally (batch system, live whiteboard, tests/video, team
portal redesign) that hadn't been committed yet. `git status` was the only
way to see the true state. Worth doing a `git commit` after each package you
apply and verify, going forward — it makes the next round's diff much easier
to reason about (for both of us) and gives you a clean rollback point per
feature.
