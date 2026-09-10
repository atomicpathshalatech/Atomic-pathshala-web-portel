"use client";

import { useEffect, useRef, useState } from "react";
import { registerBackGuard } from "./back-guards";
import { useBlockBrowserBack } from "./useBackNavigation";

/**
 * Guards a screen that must not be left silently: a running quiz, a live
 * class, a whiteboard, an editor with unsaved changes.
 *
 * What it does NOT do, deliberately: it never submits, ends, saves or
 * discards anything. It only asks. Whether leaving destroys work is the
 * screen's business; this just makes sure the user is the one who decides.
 * A back press must never be interpreted as "submit quiz" or "end class".
 *
 * Covers all three exits at once - the on-screen Back button, the Android
 * hardware key, and the browser back gesture - because it registers with the
 * shared guard registry rather than wiring its own listeners.
 *
 * Usage:
 *   const quizGuard = useNavigationGuard({
 *     when: attemptInProgress,
 *     title: "Exit this quiz?",
 *     description: "Your answers so far are saved. You can resume later.",
 *     confirmLabel: "Exit quiz",
 *     cancelLabel: "Continue quiz",
 *   });
 *   // render <NavigationGuardDialog {...quizGuard} /> somewhere in the tree
 */
export type NavigationGuardState = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** User chose to stay. */
  onCancel: () => void;
  /** User chose to leave - resolves the pending back press. */
  onConfirm: () => void;
};

export function useNavigationGuard(options: {
  /** While true, back presses are intercepted. */
  when: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Runs after the user confirms, before navigation continues. */
  onLeave?: () => void | Promise<void>;
}): NavigationGuardState {
  const [open, setOpen] = useState(false);

  // The pending back press: resolve(false) => "not handled, let the user
  // leave"; resolve(true) => "handled, stay here".
  const pendingRef = useRef<((handled: boolean) => void) | null>(null);
  const whenRef = useRef(options.when);
  whenRef.current = options.when;
  const onLeaveRef = useRef(options.onLeave);
  onLeaveRef.current = options.onLeave;

  useEffect(() => {
    const unregister = registerBackGuard(() => {
      if (!whenRef.current) return false; // nothing to protect right now

      // Already asking - swallow the repeat press rather than stacking
      // dialogs (Android users tap Back more than once when unsure).
      if (pendingRef.current) return true;

      setOpen(true);
      return new Promise<boolean>((resolve) => {
        pendingRef.current = resolve;
      });
    });
    return unregister;
  }, []);

  // Make the browser/OS back gesture ask too, but only while there is
  // something to protect.
  useBlockBrowserBack(options.when);

  const settle = (handled: boolean) => {
    setOpen(false);
    const resolve = pendingRef.current;
    pendingRef.current = null;
    resolve?.(handled);
  };

  return {
    open,
    title: options.title,
    description: options.description,
    confirmLabel: options.confirmLabel ?? "Leave",
    cancelLabel: options.cancelLabel ?? "Stay",
    onCancel: () => settle(true), // handled => stay put
    onConfirm: async () => {
      try {
        await onLeaveRef.current?.();
      } catch (err) {
        // Leaving must not be blocked by a failed cleanup - the user asked
        // to go, and trapping them is the worse outcome.
        console.error("[navigation-guard] onLeave failed:", err);
      }
      settle(false); // unhandled => navigation proceeds
    },
  };
}
