import { Skeleton } from "@/components/ui/Skeleton";

/** Full-bleed placeholder shown while a live-class room chunk loads. */
export function LiveRoomSkeleton() {
  return (
    <div className="flex h-[100dvh] w-full flex-col gap-3 bg-slate-950 p-3">
      <Skeleton className="h-10 w-full bg-slate-800/60" />
      <div className="flex flex-1 gap-3">
        <Skeleton className="flex-1 bg-slate-800/60" />
        <div className="hidden w-72 flex-col gap-3 sm:flex">
          <Skeleton className="h-40 w-full bg-slate-800/60" />
          <Skeleton className="flex-1 w-full bg-slate-800/60" />
        </div>
      </div>
      <Skeleton className="h-14 w-full bg-slate-800/60" />
    </div>
  );
}
