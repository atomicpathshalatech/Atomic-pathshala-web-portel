"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Client boundary for the ~1.2k-line ModuleEditor, which also pulls in the
 * PDF text/render stack. Loaded on demand behind a skeleton so the Team
 * shell + route paint immediately. `ssr: false` because it's fully
 * interactive/browser-only.
 */
const ModuleEditor = dynamic(
  () => import("./ModuleEditor").then((m) => m.ModuleEditor),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          <Skeleton className="h-[70vh] w-full" />
          <Skeleton className="h-[70vh] w-full" />
        </div>
      </div>
    ),
  }
);

export function ModuleEditorClient({ moduleId }: { moduleId: string }) {
  return <ModuleEditor moduleId={moduleId} />;
}
