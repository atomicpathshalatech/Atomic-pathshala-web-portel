"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface OpsBackButtonProps {
  href?: string;
  label?: string;
  fallbackHref?: string;
  className?: string;
}

export function OpsBackButton({
  href,
  label = "Back",
  fallbackHref = "/team",
  className = "",
}: OpsBackButtonProps) {
  const router = useRouter();

  const handleBack = (e: React.MouseEvent) => {
    if (href) return; // Link handles it

    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  const buttonContent = (
    <>
      <span className="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-x-0.5">
        arrow_back
      </span>
      <span>{label}</span>
    </>
  );

  const baseClasses = `group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-outline-variant/50 dark:border-slate-700/80 bg-surface dark:bg-slate-900/90 hover:bg-surface-container-high dark:hover:bg-slate-800 text-on-surface dark:text-slate-200 hover:text-primary dark:hover:text-primary font-semibold text-xs md:text-sm shadow-sm transition-all duration-150 active:scale-95 cursor-pointer select-none ${className}`;

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
      onClick={handleBack}
      className={baseClasses}
      title="Go back"
      aria-label="Go back"
    >
      {buttonContent}
    </button>
  );
}
