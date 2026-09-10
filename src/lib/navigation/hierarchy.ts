/**
 * Logical parent of a route, for the case where browser history cannot help:
 * a deep link opened in a fresh tab, a push notification, a QR code, or the
 * Android app cold-starting on a deep URL. There is nothing to go "back" to,
 * but the user still must not be stranded.
 *
 * Pure string work - no router, no React - so the hook, the Android handler
 * and tests can all share it.
 */

/** Roots: reaching one of these means there is nowhere further up to go. */
const ROOTS = new Set([
  "/",
  "/dashboard",
  "/team",
  "/guru",
  "/login",
  "/signup",
  "/forgot-password",
  "/access-denied",
  "/offline",
]);

/**
 * Path segments that exist only to nest a URL - no page is served at that
 * level, so stopping there would 404. When a parent lands on one of these,
 * we drop another segment.
 *
 * Example: /courses/x/subjects/y/chapters/z/lectures/l
 *   drop one  -> .../lectures   (no page here)
 *   drop again -> .../chapters/z  (the chapter page - correct parent)
 */
const NON_PAGE_SEGMENTS = new Set(["lectures", "chapters", "attempt", "result", "author", "edit"]);

/**
 * Explicit overrides, for parents that are not simply "one segment up".
 * Checked as prefixes against the *pattern* of the path.
 */
const EXPLICIT: Array<{ test: RegExp; parent: string | ((m: RegExpMatchArray) => string) }> = [
  // Live class rooms are entered from the schedule, not from a listing page.
  { test: /^\/live-class\/[^/]+$/, parent: "/schedule" },
  { test: /^\/team\/live-class\/[^/]+$/, parent: "/team/my-schedule" },
  { test: /^\/team\/live-studio$/, parent: "/team/my-schedule" },

  // The watch player belongs to its lecture's chapter, but the URL does not
  // carry it; the courses list is the nearest honest destination.
  { test: /^\/watch\/[^/]+$/, parent: "/watch" },

  // Test attempt/result sit under a test that has no standalone page.
  { test: /^\/tests\/[^/]+\/(attempt|result)$/, parent: "/tests" },
  { test: /^\/tests\/[^/]+$/, parent: "/tests" },

  // Student course chain.
  {
    test: /^\/courses\/([^/]+)\/subjects\/([^/]+)\/chapters\/([^/]+)\/lectures\/[^/]+$/,
    parent: (m) => `/courses/${m[1]}/subjects/${m[2]}/chapters/${m[3]}`,
  },
  {
    test: /^\/courses\/([^/]+)\/subjects\/([^/]+)\/chapters\/[^/]+$/,
    parent: (m) => `/courses/${m[1]}/subjects/${m[2]}`,
  },
  {
    test: /^\/courses\/([^/]+)\/subjects\/[^/]+$/,
    parent: (m) => `/courses/${m[1]}/subjects`,
  },
  { test: /^\/courses\/([^/]+)\/subjects$/, parent: (m) => `/courses/${m[1]}` },
  { test: /^\/courses\/[^/]+$/, parent: "/courses" },

  // Team question-extract chain.
  {
    test: /^\/team\/question-extract\/([^/]+)\/(questions|review)$/,
    parent: (m) => `/team/question-extract/${m[1]}`,
  },
];

/** Everything under /team falls back here, everything else to the student home. */
function rootFor(pathname: string): string {
  if (pathname.startsWith("/team")) return "/team";
  if (pathname.startsWith("/guru")) return "/guru";
  return "/dashboard";
}

/**
 * The page a Back press should land on when there is no usable history.
 * Always returns a real, navigable path - never "" and never the page itself.
 */
export function parentPathFor(pathname: string | null | undefined): string {
  if (!pathname) return "/dashboard";

  // Normalise: strip query/hash and any trailing slash.
  const clean = pathname.split("?")[0]!.split("#")[0]!.replace(/\/+$/, "") || "/";

  if (ROOTS.has(clean)) return rootFor(clean);

  for (const rule of EXPLICIT) {
    const m = clean.match(rule.test);
    if (m) return typeof rule.parent === "function" ? rule.parent(m) : rule.parent;
  }

  const segments = clean.split("/").filter(Boolean);

  // Drop the last segment, then keep dropping while we are standing on a
  // segment that serves no page of its own.
  segments.pop();
  while (segments.length > 0 && NON_PAGE_SEGMENTS.has(segments[segments.length - 1]!)) {
    segments.pop();
  }

  if (segments.length === 0) return rootFor(clean);

  const parent = `/${segments.join("/")}`;
  // A route group root like "/team" is a real page; anything else that
  // collapsed to nothing useful goes to the section root.
  return parent === clean ? rootFor(clean) : parent;
}

/**
 * Screens that own the whole viewport and manage their own exit affordance
 * (they must not get a second, competing Back chrome from the shell).
 */
export function isFullscreenRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    /^\/live-class\/[^/]+/.test(pathname) ||
    /^\/team\/live-class\/[^/]+/.test(pathname) ||
    pathname.startsWith("/team/live-studio") ||
    /^\/tests\/[^/]+\/attempt/.test(pathname)
  );
}

/** Root/auth screens that are intentionally exempt from a Back control. */
export function isRootRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  const clean = pathname.split("?")[0]!.replace(/\/+$/, "") || "/";
  return ROOTS.has(clean);
}
