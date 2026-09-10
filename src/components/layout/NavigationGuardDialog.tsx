"use client";

import type { NavigationGuardState } from "@/lib/navigation/useNavigationGuard";

/**
 * The confirmation shown when a guarded screen is about to be left.
 *
 * "Stay" is the default-focused, visually primary choice: the destructive
 * outcome here is losing a quiz attempt or dropping out of a live class, so
 * the safe option is the easy one to hit. The leave action is styled plainly
 * rather than as a red "danger" button, because leaving is legitimate - it
 * just should not happen by accident.
 */
export function NavigationGuardDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onCancel,
  onConfirm,
}: NavigationGuardState) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nav-guard-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative w-full sm:max-w-sm max-h-[100dvh] sm:max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-5">
        <h2 id="nav-guard-title" className="text-base font-bold text-slate-900 dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}

        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="min-h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:opacity-90 transition"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
