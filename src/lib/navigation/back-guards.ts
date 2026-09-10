"use client";

/**
 * ONE back-intent registry, shared by every way a user can go back:
 *
 *   - the on-screen Back button      (useBackNavigation)
 *   - the Android hardware Back key  (lib/platform/app-listener)
 *   - the browser/OS back gesture    (useBackNavigation's popstate guard)
 *
 * Without a single registry each of those grows its own copy of "is a quiz
 * running? is the class live? are there unsaved edits?", they drift apart,
 * and the hardware key ends up doing something the on-screen button does
 * not. Everything funnels through runBackGuards() instead.
 *
 * A guard returns true to mean "I handled this back press, stop here" -
 * e.g. it closed a sheet, or it opened a confirmation dialog and is now
 * waiting for the user's answer. Returning false means "not mine, carry
 * on", and the next guard down the stack is tried.
 *
 * Guards are consulted newest-first: the most recently mounted screen is
 * the one the user is looking at.
 */

export type BackGuard = () => boolean | Promise<boolean>;

type Entry = { guard: BackGuard; priority: number; id: number };

let nextId = 1;
const entries: Entry[] = [];

/**
 * Register a guard for as long as a screen/overlay is mounted.
 *
 * @param priority Higher runs first. Use it when two guards are mounted at
 *   once and the DOM order does not reflect what is on top - an overlay
 *   above a quiz, say. Same-priority guards run newest-first.
 * @returns an unregister function; call it on unmount.
 */
export function registerBackGuard(guard: BackGuard, priority = 0): () => void {
  const entry: Entry = { guard, priority, id: nextId++ };
  entries.push(entry);
  return () => {
    const i = entries.indexOf(entry);
    if (i > -1) entries.splice(i, 1);
  };
}

/**
 * Runs the stack until a guard claims the back press.
 *
 * A throwing guard is treated as "did not handle" rather than being allowed
 * to abort the whole chain: a broken confirmation dialog must not be able to
 * trap the user on the page, which is the exact failure this system exists
 * to prevent.
 */
export async function runBackGuards(): Promise<boolean> {
  // Newest-first within a priority level, highest priority first overall.
  const ordered = [...entries].sort((a, b) =>
    b.priority !== a.priority ? b.priority - a.priority : b.id - a.id
  );

  for (const entry of ordered) {
    try {
      if (await entry.guard()) return true;
    } catch (err) {
      console.error("[back-guards] guard threw, treating as unhandled:", err);
    }
  }
  return false;
}

/** Test/debug helper. Not used by application code. */
export function _backGuardCount(): number {
  return entries.length;
}
