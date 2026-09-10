"use client";

import React from "react";
import Link from "next/link";
import { useBackNavigation } from "@/lib/navigation/useBackNavigation";

interface OpsBackButtonProps {
  href?: string;
  label?: string;
  fallbackHref?: string;
  className?: string;
}

/**
 * The team portal's Back control. Appearance is unchanged; the behaviour now
 * comes from useBackNavigation so this and the student portal's BackButton,
 * the Android hardware key and the browser gesture all resolve "back" the
 * same way.
 *
 * What that fixes here:
 *  - it used `window.history.length > 1` to decide whether to call
 *    router.back(). That counts the whole tab's history, so opening a deep
 *    team link in a tab that had any other page in it made back leave the
 *    app entirely. The hook measures only history this app created.
 *  - the fallback was hardcoded to /team, which is right for a shallow page
 *    and wrong for a deep one; the hook walks the real hierarchy instead
 *    (a question editor falls back to its question, not to the dashboard).
 *  - it ignored guards, so Back could walk out of an editor with unsaved
 *    changes. Guards now run first.
 *
 * `href` still short-circuits everything: an explicit destination is an
 * explicit destination.
 */
export function OpsBackButton({
  href,
  label = "Back",
  fallbackHref,
  className = "",
}: OpsBackButtonProps) {
  const { goBack } = useBackNavigation({ fallbackHref });

  const buttonContent = (
    <>
      <span className="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-x-0.5">
        arrow_back
      </span>
      <span>{label}</span>
    </>
  );

  const baseClasses = `group inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-11 rounded-xl border border-outline-variant/50 dark:border-slate-700/80 bg-surface dark:bg-slate-900/90 hover:bg-surface-container-high dark:hover:bg-slate-800 text-on-surface dark:text-slate-200 hover:text-primary dark:hover:text-primary font-semibold text-xs md:text-sm shadow-sm transition-all duration-150 active:scale-95 cursor-pointer select-none ${className}`;

  if (href) {
    return (
      <Link href={href} className={baseClasses} title={`Go back to ${label}`}>
        {buttonContent}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void goBack()}
      className={baseClasses}
      title="Go back"
      aria-label="Go back"
    >
      {buttonContent}
    </button>
  );
}
