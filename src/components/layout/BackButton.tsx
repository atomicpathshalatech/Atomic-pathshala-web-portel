"use client";

import { useBackNavigation } from "@/lib/navigation/useBackNavigation";

/**
 * The app's Back control. One component for the student portal, the team
 * portal, admin screens and public pages, so behaviour and appearance cannot
 * drift between them.
 *
 * Styling matches the existing OpsBackButton (which stays as the team
 * portal's header variant) so nothing about the current look changes; this
 * adds a compact variant for mobile headers where only the arrow fits.
 *
 * Accessibility: a real <button> (keyboard reachable, announced as a
 * button), an explicit accessible name, and a 44px minimum hit area even in
 * the compact variant where the icon itself is smaller.
 */
export function BackButton({
  label = "Back",
  fallbackHref,
  variant = "default",
  className = "",
}: {
  label?: string;
  /** Where to go when the tab has no in-app history (deep link, QR, push). */
  fallbackHref?: string;
  /** "compact" shows the arrow only - for narrow mobile headers. */
  variant?: "default" | "compact";
  className?: string;
}) {
  const { goBack } = useBackNavigation({ fallbackHref });

  const base =
    "group inline-flex items-center justify-center gap-1.5 rounded-xl border border-outline-variant/50 dark:border-slate-700/80 bg-surface dark:bg-slate-900/90 hover:bg-surface-container-high dark:hover:bg-slate-800 text-on-surface dark:text-slate-200 hover:text-primary dark:hover:text-primary font-semibold shadow-sm transition-all duration-150 active:scale-95 cursor-pointer select-none";

  // min-w/min-h keep the touch target at 44px even when the label is hidden.
  const sizing =
    variant === "compact"
      ? "min-w-11 min-h-11 px-2 text-xs"
      : "min-h-11 px-3.5 py-1.5 text-xs md:text-sm";

  return (
    <button
      type="button"
      onClick={() => void goBack()}
      className={`${base} ${sizing} ${className}`}
      aria-label="Go back"
      title="Go back"
    >
      <span className="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-x-0.5">
        arrow_back
      </span>
      {variant === "default" && <span>{label}</span>}
    </button>
  );
}
