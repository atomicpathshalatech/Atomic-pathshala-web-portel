# Atomic Pathshala Enterprise

Education Operating System (ERP + LMS + CRM + AI Platform) for NEET preparation.
Built per the **locked** architecture in `ATOMIC PATHSHALA ENTERPRISE MASTER DEVELOPMENT PROMPT`.

## Phase 1 — Foundation & Core Infrastructure ✅ (this delivery)

- [x] Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui token setup
- [x] Enterprise modular folder structure (`src/modules/*` — one folder per locked portal)
- [x] PostgreSQL schema via Prisma: `User`, `Role`, `Permission`, `RolePermission`,
      `Student`, `Teacher`, `Course/Subject/Chapter` skeleton, `Notification`, `AuditLog`
- [x] Full RBAC: 15 locked roles seeded, permission catalogue, `hasPermission()` /
      `requirePermission()` guards — no hardcoded role checks
- [x] Auth.js credentials (password-only, no SMS OTP) with role-aware JWT session
- [x] Zod validation for student registration matching the exact locked field list
- [x] Student registration API (`POST /api/students/register`) — hashed password,
      uniqueness checks, enrollment number + student ID code generation, audit logging
- [x] Reusable API response contract + centralized error handling
- [x] Health check endpoint (`GET /api/health`) for uptime monitoring
- [x] `.env.example` with cost-optimized provider defaults (Neon/Supabase, Razorpay)

## Public Landing Page ✅ (converted from Stitch export)

- [x] Design tokens (Material Design 3 style — primary/on-primary, surface variants,
      display/headline/body type scale) merged into `tailwind.config.ts`
- [x] Marketing sections split into components under `src/components/landing/`:
      `Navbar`, `Hero`, `PromoBanner`, `FeatureGrid`, `BatchesSection`, `AIBentoSection`,
      `FacultySection`, `AnalyticsSection`, `TestimonialsSection`, `FAQSection`, `Footer`
- [x] WebGL hero background ported to a proper React client component
      (`HeroShaderCanvas.tsx`) with cleanup on unmount — no stray DOM listeners
- [x] Scroll-reveal animation as a reusable `ScrollReveal` client component
      (IntersectionObserver-based)
- [x] FAQ accordion given real working state (`useState`) — the Stitch export only had
      the answer markup for the first question; the other two now expand/collapse too
- [x] Removed the Tailwind CDN `<script>` tag from the Stitch export — the project uses
      the compiled Tailwind build (`tailwind.config.ts` + PostCSS) instead
- [x] `class` → `className`, `data-alt` → `alt` (real accessibility attribute) throughout
- [x] CSS-only smooth scroll (`scroll-smooth` on `<html>`) instead of a JS scroll handler

**Not yet done:** images are plain `<img>` tags pointing at temporary Google-hosted
placeholder URLs from Stitch — these need to move to real Cloud Object Storage per the
locked storage policy before this is production-ready.

## Login & Register ✅

- [x] `/login` — `src/app/(auth)/login/page.tsx` + `LoginForm.tsx` (react-hook-form +
      Zod, calls NextAuth `signIn("credentials", …)`)
- [x] `/register` — `src/app/(auth)/register/page.tsx` + `RegisterForm.tsx`, reusing
      `studentRegistrationSchema` directly so client and server validation never drift.
      Posts to the existing `/api/students/register` route; shows the generated
      Enrollment Number + Student ID on success.
- [x] Password-reset security question made mandatory client-side (schema allows it as
      optional server-side) so the locked Email + DOB + Security Question reset flow
      always has an answer to check against
- [x] `AuthSessionProvider` + `sonner` `<Toaster />` added to the root layout
- [x] Navbar's "Login/Sign Up" and "Start Learning" buttons now link to real routes

**Not yet done:** `/forgot-password` page (the form links to it, but the actual
multi-layer reset flow — Email + DOB + Security Question — isn't built yet).

## Student Portal ✅ (Dashboard, Courses/Tests placeholders, ID Card)

- [x] `middleware.ts` — real route protection for `/dashboard`, `/courses`, `/tests`,
      `/id-card`. No valid session → redirect to `/login`; wrong role → redirect home.
- [x] `requireStudentSession()` (`src/lib/auth/session.ts`) — defense-in-depth on top
      of middleware: re-checks the session server-side and loads the Student record
      from the DB in one call, since middleware runs on the edge and can't query Postgres.
- [x] `/dashboard` — real enrollment number, student ID, class, target exam pulled
      from the DB. No invented stats (attendance %, progress, etc.) — those sections
      say "coming once the Course/Test modules are live" instead of showing fake numbers.
- [x] `/id-card` — digital ID card with a real, scannable QR code (generated server-side
      via the `qrcode` package) encoding the student's ID. Regenerated per page view;
      not yet cached to `Student.qrCodeUrl` since that needs the Cloud Storage pipeline.
- [x] `/courses`, `/tests` — honest "Coming Soon" placeholders (Course Engine / Test
      Engine are Phase 3), not dead links or fake content.
- [x] Login now redirects to `/dashboard` on success (previously went to `/`, since
      the portal didn't exist yet).

## Student Portal — additional pages ✅ (Stitch designs converted)

- [x] `/tests` — Test Analysis & Resource Center (was a placeholder, now the full
      designed UI). Scorecard and PDF vault use clearly-labeled sample data — real
      numbers arrive once the Test Engine (Phase 3) exists.
- [x] `/dpp` — Daily Practice Papers portal, grouped by subject with
      Pending/Completed/Overdue states. Sample data pending the Team Portal's
      DPP-publishing tools.
- [x] `/schedule` — Batch Roadmap & Schedule: calendar + timeline of classes/tests
      and syllabus milestones. Sample data pending Academic Planning (Phase 3+).
- [x] `/notifications` — Notification Center with a real, working category filter
      (`NotificationFeed.tsx`, React state — the original design's vanilla-JS
      `event.currentTarget` toggle was replaced with a proper client component).
      Sample notifications pending real actions (class scheduling, DPP publish,
      test grading) writing to the `Notification` table.
- [x] Sidebar nav and route protection (`middleware.ts`) updated to cover all four
      new routes.

All four intentionally reuse the existing shared portal shell (topbar + sidebar in
`(student)/layout.tsx`) instead of each carrying its own header/nav/footer, since
the Stitch exports were standalone mockups — only the main content region was
ported page by page.

## Team Portal — foundation ✅ (Admin/Staff area, RBAC-driven)

- [x] `middleware.ts` now also guards `/team/*` — logged-out → `/login`; a
      Student/Parent/Guest hitting `/team` → redirected home.
- [x] `requireTeamSession()` (`src/lib/auth/session.ts`) — the DB-backed check
      behind middleware. Unlike the student check, this isn't a single-role
      comparison: it checks the new `TEAM_PORTAL_ACCESS` permission via RBAC,
      since Team Portal spans 11 different roles.
- [x] `getUserPermissionCodes()` (`src/lib/rbac/guard.ts`) — fetches every
      permission a user holds in one query, used to filter the sidebar so
      each role only sees the modules it's actually allowed to open.
- [x] New permission codes added for modules not built yet: Question Bank,
      Doubt Desk, Coupons, Notifications — plus `ROLE_PERMISSION_DEFAULTS`
      filled in for the previously-missing roles (Question Team, Content
      Team, Support, HR, Marketing, Department Head).
- [x] `/team` — role-aware hub page. Shows a card per module the signed-in
      role has permission for; modules without a real page yet show a
      "Coming Soon" badge instead of a dead link.
- [x] Login now redirects by role: Student → `/dashboard`, every other team
      role → `/team`.

**⚠️ Action needed:** the permission catalogue changed, so re-run the seed
script (safe — it's upsert-based, won't duplicate or wipe anything):
```powershell
npm run db:seed
```

**Not yet built:** Coupon Management, Bulk Notifications, CRM, Finance,
Analytics — `/team` still shows these as "Coming Soon" for whichever role can
see them.

## Question Bank ✅ (first Team Portal module)

- [x] `Question` model — MCQ or Integer type, 4 options, correct answer,
      explanation, per-question marking scheme, difficulty, tags, optional
      Subject/Chapter classification, and a verification workflow
      (`PENDING` → `VERIFIED`/`FLAGGED`, tracked with `verifiedBy` +
      `verifiedAt`).
- [x] `/team/questions` — Database Explorer with real stats (Verified /
      Pending / Flagged counts straight from Postgres), search + filters,
      pagination.
- [x] `/team/questions/new` and `/team/questions/[id]/edit` — shared
      `QuestionForm.tsx`, MCQ/Integer toggle, scoring, difficulty,
      subject/chapter classification (handles zero subjects existing yet),
      tags.
- [x] Every write is audit-logged.

**Left out on purpose:** the Test Builder / paper-assembly half of the
original "Admin Test Portal" design — turning questions into a publishable
test paper needs its own `Test`/`TestQuestion` models and belongs to Test
Engine work (Phase 3), not Question Bank itself.

## Doubt Desk ✅ (second Team Portal module — student ↔ team loop)

Unlike Question Bank (team creates its own content), Doubt Desk only has real
content if students can actually submit doubts — so this shipped as two
connected halves instead of an admin-only page:

- [x] New `Doubt` model — student-submitted, with subject (free text), body,
      priority, a status workflow (`OPEN` → `RESOLVED`/`FLAGGED`), and the
      resolving expert's explanation + optional video URL, tracked with
      `resolvedBy` + `resolvedAt`.
- [x] **Student side:** `/doubts` — a real "Ask a Doubt" form
      (`DoubtForm.tsx`) plus a list of the student's own submitted doubts and
      their live status. Once a team member resolves one, the explanation
      (and video link, if given) shows up here automatically.
- [x] **Team side:** `/team/doubts` — split-pane workspace
      (`DoubtDeskWorkspace.tsx`) matching the "Doubt Expert Workspace"
      design: a filterable feed (Open/Resolved/Flagged) on the left, full
      doubt detail + resolution form on the right.
- [x] API: `POST/GET /api/doubts` (student submit + own history — checked
      against the caller's own Student record, not RBAC, since this is a
      basic student action rather than a team-portal permission), `GET
      /api/team/doubts` (+ `[id]`), `PATCH /api/team/doubts/[id]/resolve`
      (gated by `DOUBT_RESOLVE`, separate from `DOUBT_READ`).
- [x] Every resolution is audit-logged.

**Left out on purpose:** the original design's "Difficulty Audit Tool" (success
rate, avg. time spent per question) needs real test-attempt data that doesn't
exist yet (no Test Engine), so showing it would mean fabricated numbers —
skipped rather than faked, same call as the Test Builder panel in Question
Bank.

**⚠️ Action needed:** another schema change (new `Doubt` model + 2 enums):
```powershell
npx prisma migrate dev --name add_doubt_desk
```

## Educator Dashboard & Faculty Profiles ✅ (third Team Portal module)

- [x] **Onboarding** (`/team/faculty/new`, Academic Head/HR only) — creates
      the login (`User`, role `TEACHER`) and the `Teacher` profile
      (employee code, department, subjects, bio) together in one
      transaction.
- [x] **Faculty directory** (`/team/faculty`) — every onboarded educator,
      real data, click through to edit.
- [x] **Admin edit** (`/team/faculty/[id]/edit`, Academic Head/HR) — full
      edit of any teacher's profile.
- [x] **Self-service profile** (`/team/profile`) — a teacher can update their
      own subjects/bio, but not employee code or department (HR-controlled);
      shown read-only with a note on who to contact for changes.
- [x] **Educator Dashboard** — folded into the existing `/team` hub rather
      than a separate page: when the signed-in user has a `Teacher` profile,
      the hub shows their faculty card (department, employee code, link to
      edit) plus a **real** open-doubts count. No invented stats (student
      reach, live hours taught, engagement charts from the original design)
      — those need data this build doesn't have yet, so they're left out
      rather than faked.
- [x] Fixed a bug in `/api/team/faculty`: duplicate email/employee-code
      errors were being swallowed into a generic "Something went wrong"
      instead of reaching the form — now shows the specific reason.

**⚠️ Action needed:** `HR`'s permissions changed (gained `TEACHER_CREATE` /
`TEACHER_UPDATE`), so re-seed (safe, upsert-based):
```powershell
npm run db:seed
```

## Faculty Onboarding Queue ✅ (recruitment pipeline)

A separate flow from direct onboarding above — this is for candidates who
haven't been hired yet:

- [x] `TeacherApplication` model — public applicant info (name, email, phone,
      subject, years experience, bio, resume/portfolio links as URLs — no
      file upload pipeline yet, same limitation as everywhere else in this
      build), status (`PENDING` → `INTERVIEWING` → `VERIFIED`/`REJECTED`/
      `ARCHIVED`).
- [x] **Public application form** (`/careers/apply`, no login required) —
      posts to `/api/careers/apply`.
- [x] **Review queue** (`/team/faculty/applications`, Academic Head/HR) —
      split-pane like Doubt Desk: filterable list on the left (by status),
      full applicant detail + actions on the right (Schedule Interview,
      Reject, Archive).
- [x] **Approve & Hire** — turns an application straight into a real login +
      Teacher profile in one transaction (employee code, department,
      subjects, temp password collected at approval time, since the public
      form intentionally doesn't ask for internal-only fields like employee
      code). Reuses the same duplicate-email/employee-code checks as direct
      onboarding.
- [x] Linked from `/team/faculty` ("Review Applications" button).

**Left out on purpose:** the original design's e-signature contract workflow,
document-upload verification (ID proof, degree certificates), background-check
integration, and penalty/compliance/earnings tracking — those need real file
storage, e-signature, and payment infrastructure this build doesn't have.
Resume/portfolio are plain URL fields for now (candidate pastes a Google
Drive/LinkedIn link, say) rather than uploads.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, NEXTAUTH_SECRET, etc.
npm run db:migrate     # creates tables from prisma/schema.prisma
npm run db:seed        # seeds roles + permissions
npm run dev
```

Generate a secret: `openssl rand -base64 32`

## Verify

- `GET /api/health` → `{ success: true, data: { status: "ok", database: "connected" } }`
- `POST /api/students/register` → creates a `User` + `Student` + `AuditLog` row

## Folder Structure

```
src/
  app/              route groups: (public) (auth) (student) (team) (admin), api/
  modules/          one folder per locked portal (student-portal, crm, finance, ai-platform, ...)
  lib/
    rbac/           permission catalogue + guard helpers
    validation/     Zod schemas
    api/            response helpers
    db.ts           Prisma client singleton
    auth.ts         NextAuth config
  server/
    actions/        Server Actions (mutations)
    services/       business logic, reusable across routes/actions
  types/            shared TS types + NextAuth augmentation
prisma/
  schema.prisma     single source of truth for the DB
  seed.ts           RBAC seed
```

## Roadmap (subsequent phases — not yet built)

- **Phase 2** — Student Portal UI: registration/login screens, dashboard, ID card + QR, profile
- **Phase 3** — Course Engine: Course→Subject→Chapter→Lecture flow, recorded lecture player, notes
- **Phase 4** — Test Engine: question bank (unified repository), quizzes, mock tests, results, ranking
- **Phase 5** — CRM Portal: lead capture, counsellor assignment, follow-ups, funnel reports
- **Phase 6** — Finance Portal: Razorpay integration, invoices, coupons, refunds
- **Phase 7** — Team Portal (ERP): employee management, departments, attendance, leave, approvals
- **Phase 8** — Analytics + Founder Dashboard: real-time KPIs across all modules
- **Phase 9** — Content Management Portal: uploads, versioning, approval workflow
- **Phase 10** — AI Platform: AI chat, doubt solver (image/voice), AI quiz/notes/mentor
- **Phase 11** — Live Studio Portal, Marketing Portal, Affiliate Portal, Competition/Certificate Portals
- **Future** — Parent Portal, Franchise Portal, Career Portal, mobile app support (same backend, no changes)

Each phase should be approved before implementation, per the locked development rules
("Every module documented before implementation", "Never break existing architecture
without approval").
