"use client";

import { useEffect, type ReactNode } from "react";

/**
 * The app's shared modal shell.
 *
 * 68 overlays are currently hand-rolled from `fixed inset-0`, and only 22 of
 * them cap their height against the viewport. The rest can grow taller than
 * the screen with no scroll container, which puts the close and submit
 * buttons somewhere below the fold and unreachable -- worst on a landscape
 * phone, where the viewport is only ~375px tall.
 *
 * This shell fixes that once:
 *  - the panel never exceeds the visible viewport (`dvh`, so the mobile
 *    address bar is accounted for) and scrolls internally when it would;
 *  - it uses the full width on small screens with a real margin, and a
 *    bounded width above that, so it can never sit outside the viewport;
 *  - Escape and backdrop clicks close it, and body scroll is locked while
 *    it is open, so the page behind cannot scroll away under it;
 *  - it sits on the named `z-modal` layer rather than competing with the 82
 *    other elements that claim a flat `z-50`.
 */
const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const;

export type ModalSize = keyof typeof SIZES;

export function Modal({
  open,
  onClose,
  children,
  size = "md",
  labelledBy,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
  /** id of the element naming this dialog, for screen readers */
  labelledBy?: string;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    // Lock background scroll while open. Restores the previous value rather
    // than assuming "" so nested/stacked modals do not clobber each other.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`relative w-full ${SIZES[size]} max-h-[100dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
