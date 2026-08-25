# Team Portal Redesign — Sidebar + Calendar Shell

This update restructures the Team Portal's chrome — the sidebar/top-bar
shell around every `/team/*` page — from a horizontal scrolling top-nav to
a left sidebar + top bar layout, following the structure of the reference
screenshots (a competitor's educator dashboard) you shared: grouped sidebar
nav, top bar with a profile menu on the right, and a calendar widget on the
dashboard.

**What this is not:** a pixel clone. The reference site's logo, colors, and
exact copy aren't reproduced — that's someone else's brand. What's rebuilt
is the *structural pattern* (sidebar-with-sections, top-bar-with-avatar-menu,
month-grid calendar), using this project's own name, design tokens
(`glass-card`, `primary`, `font-headline-md`, etc.), and real data.

## Why a layout-level change reaches every team page

`src/app/(team)/team/layout.tsx` is a Next.js layout — every page under
`/team/*` (Batches, Tests, Question Bank, Doubt Desk, all of it) already
renders as `{children}` inside it. Rewriting the layout's chrome once means
every existing team page automatically picks up the new sidebar/top-bar
shell with **zero changes to that page's own content** — you don't have to
touch `batches/page.tsx`, `questions/page.tsx`, etc. individually. That's
why this package is small (6 files) despite "the whole Team Portal" being
the ask.

## What changed and why

- **Old:** a single flat `MODULES` array (17 items) as a horizontal,
  side-scrolling nav strip — the kind of layout that stops scaling once you
  have more than about 6-8 items, which this app already had.
- **New:** the same permission-gated items, grouped into labeled sections
  (Teaching / People / Growth / Finance & Insights / My Account) in a
  scrollable left sidebar. Same RBAC rule as before — `getUserPermissionCodes`
  filters both which items *and* which whole sections show, so a role with
  nothing in "Finance & Insights" never sees that empty header.
- **Fixed a real gap along the way:** `/team/tests` (the Test Engine, built
  in an earlier update) was never linked from the main nav — it only worked
  if you typed the URL directly. It's now in the sidebar under Teaching, and
  added as a dashboard module card too.
- **New:** a profile dropdown (`TeamProfileMenu`) replaces the old
  always-visible name/role/sign-out row — click the avatar top-right for
  "My Profile" (only shown if you have a Teacher record — same rule the
  dashboard already used) and Sign Out (reuses the existing `LogoutButton`,
  not reimplemented).
- **New:** a real month-grid calendar (`CalendarWidget`) on the dashboard,
  shown only to users with a Teacher profile (matching the existing "Faculty
  Profile" card's visibility rule — a Sales/Finance/HR team member wouldn't
  have a teaching timetable to show). It's wired to actual `BatchSchedule`
  rows for that teacher (their own assigned schedules, plus anything on a
  batch they're on via `BatchTeacher`) over the next 60 days — dot-marked
  on the grid, and listed underneath as "Coming Up". Prev/next month
  navigation works; nothing here is mock data.
- **Mobile:** the sidebar collapses behind a hamburger button (top-left) and
  opens as a slide-over drawer, since a permanent sidebar doesn't fit a
  phone screen the way the reference desktop layout does.

## New/changed files

**New:**
- `src/components/team-portal/TeamShell.tsx` — the sidebar + top bar shell
  (client component: `usePathname` for active-link highlighting, `useState`
  for the mobile drawer)
- `src/components/team-portal/TeamProfileMenu.tsx` — the avatar dropdown
- `src/components/team-portal/CalendarWidget.tsx` — the month-grid calendar
  (pure props in, no `new Date()` during render — see the comment in the
  file for why: avoids a server/client hydration mismatch)

**Changed:**
- `src/app/(team)/team/layout.tsx` — grouped nav config + renders
  `<TeamShell>` instead of the old top-nav markup
- `src/app/(team)/team/page.tsx` — same module-card grid as before, plus a
  right-hand column (calendar + "Coming Up" list) for users with a teacher
  profile; added the missing Tests card

No `package.json` or `.env.example` changes — this update needs no new
dependencies or environment variables.

## Known limitations

- **Calendar only shows for users with a Teacher profile.** Non-teaching
  roles (Sales, Finance, HR, Support, etc.) see the module-card grid at
  full width with no calendar column — there's no per-role timetable
  concept for them to show yet.
- **"My Profile" in the dropdown links to `/team/profile`,** same as the
  original dashboard's "Edit My Profile" link — this assumes that route
  already exists in your project (it wasn't in the files available while
  building this, same caveat as other updates: verify it works, or point it
  elsewhere if the real path differs).
- **`LogoutButton`'s exact visual styling wasn't available** while building
  this (it's an existing component in your project we didn't have the
  source for) — it's dropped into the profile dropdown and the mobile
  drawer as-is. If its own styling looks visually inconsistent sitting
  inside the dropdown panel (e.g. it renders as a large colored button
  rather than a plain menu row), that's a quick CSS tweak in
  `TeamProfileMenu.tsx` / `TeamShell.tsx`, not a functional issue.
- **No sidebar collapse-to-icons-only mode on desktop** — the reference
  site doesn't have one either at the width shown, so this matches; add one
  later if the sidebar ever feels too wide.

## Apply steps

1. Merge these files into your project (same as previous updates — copy
   the matching folders over).
2. No `npm install`, no migration — this is UI-only. `npm run dev` and
   visit `/team` as any team-portal user.
3. Test as a couple of different roles if you can (e.g. a Teacher and an
   Academic Head) to confirm the sidebar sections show/hide correctly based
   on permissions, and that the calendar column appears only for the
   Teacher.
