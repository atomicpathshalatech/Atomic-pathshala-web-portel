/** Shown in the Android app where a purchase would be (see useIsNativeApp). */
export function NotInAppNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-600 ${className}`}>
      <span className="material-symbols-outlined mb-1 block text-2xl text-slate-400">info</span>
      Purchases aren&apos;t available in the app.
    </div>
  );
}
