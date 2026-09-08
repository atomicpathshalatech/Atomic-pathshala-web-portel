import { Skeleton, SkeletonCardGrid } from "@/components/ui/Skeleton";

/**
 * Default instant fallback for every route under `(team)/team/*`.
 *
 * Team pages carry the heaviest server-side cost in the app (RBAC + several
 * cross-region Prisma round trips before the page's own queries even start),
 * so an instant skeleton here removes the worst "click → frozen → page"
 * stalls. Individual routes can override with a closer-fitting shape.
 */
export default function TeamLoading() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-16" />
          </div>
        ))}
      </div>

      <SkeletonCardGrid count={6} />
    </div>
  );
}
