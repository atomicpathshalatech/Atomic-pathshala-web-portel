import { Skeleton, SkeletonCardGrid } from "@/components/ui/Skeleton";

/**
 * Default instant fallback for every route under `(student)/*`.
 *
 * Next.js paints this the moment a `<Link>` inside the Student portal is
 * activated, so navigation feels immediate even while the server component
 * completes its (cross-region) data fetch. Route folders that want a
 * closer-fitting shape override this with their own `loading.tsx`.
 */
export default function StudentLoading() {
  return (
    <div className="space-y-6 max-w-7xl">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-3 w-80 max-w-full" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <SkeletonCardGrid count={6} />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <SkeletonCardGrid count={3} />
      </div>
    </div>
  );
}
