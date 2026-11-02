import Link from "next/link";

/**
 * Persistent (non-popup) reminder shown on the dashboard and profile while a
 * student has no profile photo. Nothing else is blocked — only the ID card
 * waits for the photo.
 */
export function PhotoPendingNotice({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-amber-300/70 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${className}`}
      role="status"
    >
      <div className="flex items-start gap-3 flex-1">
        <span className="material-symbols-outlined text-amber-600 text-[26px] shrink-0">badge</span>
        <p className="text-sm text-amber-900 dark:text-amber-100">
          <span className="font-bold">Your profile photo is pending.</span> Please upload your photo to generate your Atomic Pathshala Student ID Card.
        </p>
      </div>
      <Link
        href="/id-card#photo"
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-[#0f3a9e] hover:bg-[#0a2463] text-white whitespace-nowrap"
      >
        <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
        Upload Profile Photo
      </Link>
    </div>
  );
}
