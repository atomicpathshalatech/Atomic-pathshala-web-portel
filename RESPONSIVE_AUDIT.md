# Atomic Pathshala — Responsive Audit Report (Phase 23)

**Scope audited:** 130 pages, 230 components, 6 layouts, `tailwind.config.ts`, `globals.css`.
**Status:** Audit only. No layout code has been changed yet.

---

## 1. Current global layout architecture

| Level | File | What it does |
|---|---|---|
| Document | `src/app/layout.tsx` | `<body class="... overflow-x-hidden">` — global horizontal-overflow **suppression** |
| Route groups | `(auth)`, `(parent)`, `(student)`, `(team)/team`, `guru`, root | 6 independent layouts |
| Team shell | `src/components/team-portal/TeamShell.tsx` | Header + `w-64` sidebar (lg+) + drawer (<lg) |
| Student shell | `src/components/student/StudentShell.tsx` | Header + drawer only — **no desktop sidebar at all** |
| Page level | 61 pages | Each declares its own `max-w-*` wrapper |

**The core finding: there is no single layout system. Three container strategies run in parallel.**

| | TeamShell | StudentShell | Individual pages |
|---|---|---|---|
| Max width | none (full bleed) | `max-w-7xl` (1280px) | `max-w-6xl`, `5xl`, `4xl`, `3xl`, `2xl`, `container-max`… |
| Horizontal padding | `20px` → `64px` at `md` | `16px` → `24px` → `32px` | varies per page |
| Header height | `top-[65px]` | `h-[64px]` | `top-[73px]` elsewhere |
| Nav on desktop | fixed sidebar | drawer only | — |

`max-w-*` values actually in use across the codebase: **8 different scales** (`7xl`×30, `6xl`×23, `5xl`×21, `4xl`×23, `3xl`×36, `2xl`×41, `md`×52, `container-max`×13). This is why the same content occupies a different width on nearly every page.

---

## 2. Current breakpoint strategy

- `tailwind.config.ts` defines **no custom `screens`** → Tailwind defaults apply: `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`.
- **This already matches the breakpoint system requested in Phase 4.** The breakpoints are not the problem; their inconsistent application is.
- `container.screens` is set to only `2xl: 1400px` with a flat `padding: 2rem` — 32px of padding even at 320px viewport.

**Bugs found in the breakpoint layer:**

1. **`xs:` is used but never defined.** `src/components/live-class/StudentLiveClassRoom.tsx` uses `hidden xs:flex`. Since `xs` does not exist in the config, Tailwind never generates `xs:flex` — so the element is **permanently hidden at every screen size**, not just small ones. Dead classes.
2. **Zero fluid sizing.** `clamp()` appears **0 times** in the entire codebase. Every font size and layout dimension is a discrete step.
3. **Container queries are installed but never used.** `@tailwindcss/container-queries` is in the plugin list; `@container` / `container-type` appear **0 times**. Components respond to viewport only, never to the space they actually occupy — which is why a card behaves differently inside the team sidebar layout vs the full-width student layout.

---

## 3. Major responsive problems, ranked by blast radius

### P0 — Live Class teacher room is a fixed-pixel grid with no breakpoints

`src/components/live-class/TeacherLiveClassRoom.tsx:1320`

```jsx
className="fixed inset-0 w-screen h-screen grid ... overflow-hidden z-50"
style={{ gridTemplateColumns: "64px minmax(0, 1fr) 320px", gridTemplateRows: "56px 1fr 64px" }}
```

- The track sizes are in an **inline `style`**, so no Tailwind breakpoint can ever override them.
- Fixed chrome = `64px + 320px = 384px` at **every** viewport width.
  - At 1024px laptop → 640px left for the board.
  - At 768px tablet → 384px left for the board.
  - At 375px phone → **the right panel alone is wider than the screen**; the canvas column collapses toward zero and the panel is pushed outside the viewport.
- `h-screen` (100vh) → on mobile the 64px toolbar row sits underneath the browser address bar and is unreachable.

**This single line is the primary cause of "the layout breaks on laptop, tablet and mobile" in the classroom.**

### P0 — Teacher and Student classrooms use two different layout systems

| | Teacher (`TeacherLiveClassRoom.tsx:1320`) | Student (`StudentLiveClassRoom.tsx:746`) |
|---|---|---|
| Engine | CSS Grid, inline fixed px tracks | Flexbox, `flex-col` |
| Height | `h-screen` (100vh) | `h-[100dvh]` ✅ |
| Header | fixed `56px` row | `h-12 sm:h-14` ✅ responsive |
| Breakpoints | **none** | `sm:` used throughout |

The student room is already close to correct; the teacher room was never made responsive. They must be brought onto one shared shell.

### P0 — Viewport-height unit is wrong in 15 places

`min-h-screen` ×12 and `h-screen` ×3 (= `100vh`) against only **2** uses of `dvh`. On mobile Chrome/Safari, `100vh` is taller than the visible area, so bottom toolbars, submit buttons and footers fall below the fold.

Affected: `TeamShell.tsx:45,52`, `StudentShell.tsx:205`, `TeacherLiveClassRoom.tsx:1320`, `ExamRunner.tsx:540`, `DualColumnQuestionStudio.tsx:247`, `TestAttemptView.tsx:171`, `CheckoutView.tsx:35`, `ChapterDetailView.tsx:67`, `CourseDetailMasterView.tsx:20`, `AtomicVideoPlayer.tsx:218`, `(team)/team/academic/page.tsx:37`, `(parent)/layout.tsx:15`.

### P0 — Three different hardcoded header heights

`TeamShell.tsx:82` pins the sidebar with `sticky top-[65px] h-[calc(100vh-65px)]`, `StudentShell.tsx:208` sets `h-[64px]`, and a third component uses `top-[73px]`. The moment the header wraps (long user name, tablet width, or browser zoom at 125%) these offsets are wrong and the sidebar misaligns or gets clipped. Phase 22 explicitly requires 125%/150% zoom to work.

### P1 — Tables forcing horizontal overflow

`min-w-[720px]` ×2 in `team-portal/TeacherCommandCenter.tsx:262,297` and `min-w-[760px]` ×2 in `ai-chat/AdminDashboard.tsx:262,300`. These force the page wider than any phone or tablet-portrait viewport. 22 `<table>` elements exist against 46 `overflow-x-auto` wrappers — coverage is partial, not systematic.

### P1 — `overflow-x-hidden` on `<body>` hides the real bugs

`src/app/layout.tsx` suppresses horizontal overflow globally. Overflow sources are never visible during development, they simply silently clip content — and clipping is what users experience as "content cut off on mobile".

### P1 — Flat z-index with no scale

**82** elements use `z-50`, 67 use `fixed inset-0`, and only **1** uses `role="dialog"`. Every overlay is hand-rolled. When two `z-50` siblings meet, paint order decides — this is exactly the class of bug already hit this session (the toolbar backdrop that swallowed the first click of every button).

### P2 — Fixed pixel heights on content panels

`h-[600px]`×3, `h-[580px]`, `h-[500px]`×4, `h-[480px]`, `h-[420px]`×3, `h-[400px]`×4, `h-[360px]`×3. On a 667px-tall phone a `h-[600px]` panel plus header leaves nothing usable.

### P2 — Typography is fixed-px with a manual mobile variant

`tailwind.config.ts` defines `display-lg: 48px` alongside a separate `display-lg-mobile: 36px` token. Scaling depends on a developer remembering to swap the token per breakpoint; nothing scales continuously between 640px and 1536px.

---

## 4. Components with hardcoded dimensions (exact locations)

| File | Line | Value | Impact |
|---|---|---|---|
| `live-class/TeacherLiveClassRoom.tsx` | 1320 | `64px / 320px` grid tracks, `h-screen` | classroom unusable < 1024px |
| `team-portal/TeamShell.tsx` | 82 | `top-[65px]`, `calc(100vh-65px)` | sidebar misaligns on zoom/wrap |
| `team-portal/TeamShell.tsx` | 45 | `w-screen h-screen` | 100vh + scrollbar overflow |
| `student/StudentShell.tsx` | 208 | `h-[64px]` | header height mismatch with team |
| `team-portal/TeacherCommandCenter.tsx` | 262, 297 | `min-w-[720px]` | forces page-wide h-scroll |
| `ai-chat/AdminDashboard.tsx` | 262, 300 | `min-w-[760px]` | forces page-wide h-scroll |
| `question-bank-hierarchical/HierarchicalMindmapView.tsx` | 135, 186 | `min-w-[240/260px]` | grid cannot reflow |
| `question-bank-hierarchical/HierarchicalSearchFilter.tsx` | 76 | `min-w-[240px]` | filter row overflows |
| `home-cms/HomeSectionBuilder.tsx` | 260 | `min-w-[240px]` | builder overflows |
| `team/tests/page.tsx` | 94 | `min-w-[240px]` | filter bar overflows |
| `team/dpp/page.tsx` | 97 | `min-w-[200px]` | filter bar overflows |
| `(student)/profile/page.tsx` | 75 | `min-w-[160px]` | stat row overflows |
| `student/result/ResultOverviewCard.tsx` | 75, 88, 110 | `min-w-[130/170/140px]` | result cards overflow |
| `team-portal/DocumentVerificationPanel.tsx` | 89 | `min-w-[220px]` | panel overflows |
| `live-class/StudentLiveClassRoom.tsx` | ~758 | `xs:` (undefined) | element hidden at all sizes |

---

## 5. What breaks, by device class

**Mobile (< 640px)** — teacher classroom right panel pushed off-screen; `100vh` toolbars under the address bar; `min-w-[720/760px]` tables force page-wide horizontal scroll (clipped, not scrollable, because `body` has `overflow-x-hidden`); filter rows with `min-w-[200–260px]` cannot wrap; 67 hand-rolled overlays with no viewport-fit rules; fixed `h-[400–600px]` panels exceed the screen.

**Tablet (768–1023px)** — no sidebar in either shell, so tablet gets the mobile drawer while still rendering desktop-density content; TeamShell jumps straight from 20px to 64px padding at `md`, costing 128px of a 768px viewport; teacher classroom still reserves its full 384px of fixed chrome.

**Laptop (1024–1279px)** — TeamShell: 256px sidebar + 128px padding = 384px of chrome, leaving ~640px of content on a 1024px screen; teacher classroom leaves 640px for a board that assumes far more; header offsets break at 125% zoom.

**Desktop / large desktop (1280px+)** — TeamShell has no `max-width`, so content stretches edge-to-edge on a 2560px monitor while StudentShell caps at 1280px: the two halves of the same product look like different apps.

---

## 6. Shared components that must be created or corrected

Currently none of these exist; the same problem is solved (or not solved) individually in dozens of files:

1. **`PageContainer`** — one max-width + responsive padding scale, replacing 61 ad-hoc `max-w-*` wrappers.
2. **`AppShell`** (shared by TeamShell + StudentShell) — one header-height CSS variable (`--header-h`), one sidebar width token, one drawer implementation.
3. **`ResponsiveTable`** — a scroll container + card-list fallback, replacing per-table `min-w-[…]`.
4. **`Modal` / `Dialog`** — one viewport-fitting overlay with a z-index token and a focus-trapped close, replacing 67 hand-rolled `fixed inset-0` blocks.
5. **`LiveClassShell`** — one responsive grid for teacher + student rooms (Phase 14: 16:9 preserved via `aspect-video` on the stage, not via fixed track widths).
6. **z-index scale** in `tailwind.config.ts` (`z-base / z-sticky / z-drawer / z-modal / z-toast`) to replace 82 flat `z-50`s.
7. **Fluid type scale** — `clamp()`-based tokens replacing the `*-mobile` token duplication.

---

## 7. Proposed implementation order

Matches the Phase 20 order, adjusted so the highest-impact fix is not last:

1. `tailwind.config.ts` — add `xs: 480px`, z-index scale, fluid `clamp()` type tokens, container padding scale.
2. `globals.css` — header-height CSS var, `min-width: 0` default for flex/grid children, viewport-unit helpers (`dvh`).
3. `src/app/layout.tsx` — remove the global `overflow-x-hidden` mask **last**, after real overflow sources are fixed.
4. `AppShell` + `PageContainer` → adopt in `TeamShell` and `StudentShell` (unifies header height, padding, max-width, sidebar).
5. `TeacherLiveClassRoom.tsx:1320` — replace the inline fixed grid with the responsive `LiveClassShell` (P0).
6. `StudentLiveClassRoom.tsx` — adopt the same shell; fix the dead `xs:` classes.
7. `ResponsiveTable` → apply to `TeacherCommandCenter`, `AdminDashboard`, then remaining tables.
8. Modal/dropdown pass across the 67 overlays.
9. Dashboards, forms, remaining pages.
10. Viewport sweep at the 16 widths + zoom levels.

---

## 8. Risk of breaking existing functionality

| Area | Risk | Mitigation |
|---|---|---|
| Whiteboard canvas | **Highest.** The engine maps pointer events through a 1920×1080 virtual coordinate system and a `ResizeObserver` → `syncSize()`. Changing the stage's box changes the scale factor. | Keep the virtual coordinate system untouched; only change the *container*. `syncSize()` already runs on resize, so a fluid container is compatible. Verify drawing accuracy at each width after the change. |
| Live class realtime | Low | No Pusher/LiveKit code touched; layout only. |
| Teacher toolbar | Medium | It currently relies on the fixed 64px footer row; moving to a responsive shell needs the popup stacking (recently fixed) re-verified. |
| Exam runner / anti-cheat | Medium | `ExamRunner.tsx` uses `min-h-screen`; switching to `dvh` changes nothing functionally but must be re-tested since fullscreen/anti-cheat logic reads viewport state. |
| Tables → card fallback | Low-Medium | Purely presentational, but row actions must remain reachable in card mode. |
| Everything else | Low | CSS-class level changes only. No API, DB, auth, realtime or business logic touched. |

**Not touched at any point:** APIs, Prisma/database, auth, RBAC, realtime, quiz/poll logic, file generation, payments.

---

## 9. Note on the current repo state (raised separately)

Commit `40a75aa` added ~178 lines of new Prisma models (AI Question Generator) but `prisma/migrations/` has no matching migration folder — the live database does not have those tables. That is a separate, pre-existing issue from this responsive work, but it will produce runtime errors independently of anything done here.
