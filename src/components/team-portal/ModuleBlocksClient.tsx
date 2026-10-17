"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";

const ModuleEditor = dynamic(() => import("./ModuleEditor").then((m) => m.ModuleEditor), {
  ssr: false,
  loading: () => <Skeleton className="h-[60vh] w-full" />,
});

export function ModuleBlocksClient({ moduleId }: { moduleId: string }) {
  return (
    <div className="space-y-3">
      <Link href={`/team/modules/${moduleId}`} className="inline-flex items-center gap-1 text-label-sm text-primary hover:underline">
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Back to the PDF editor
      </Link>
      <ModuleEditor moduleId={moduleId} />
    </div>
  );
}
