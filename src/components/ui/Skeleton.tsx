import { cn } from "@/lib/utils";

/**
 * Lightweight skeleton primitive used by route-level `loading.tsx` files so
 * that every client-side navigation paints an instant shell instead of
 * freezing on the previous page while the server component streams.
 *
 * Pure CSS (`animate-pulse`), no JS, no client boundary — it renders as part
 * of the RSC fallback the moment a `<Link>` is clicked.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-700/40", className)}
    />
  );
}

/** A generic "card with a few text lines" block, the most common shape. */
export function SkeletonCard({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5",
        className
      )}
    >
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

/** A responsive grid of skeleton cards. */
export function SkeletonCardGrid({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
