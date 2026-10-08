"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Client boundary for the ~1.2k-line ModuleEditor, which also pulls in the
 * PDF text/render stack. Loaded on demand behind a skeleton so the Team
 * shell + route paint immediately. `ssr: false` because it's fully
 * interactive/browser-only.
 */
const FoxitModuleEditor = dynamic(
  () => import("./FoxitModuleEditor").then((m) => m.FoxitModuleEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] gap-4 bg-slate-950 text-slate-200">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-sm">Opening Native Foxit-Style PDF Editor...</p>
      </div>
    ),
  }
);

export function ModuleEditorClient({ moduleId, userRole }: { moduleId: string; userRole?: string }) {
  return <FoxitModuleEditor moduleId={moduleId} userRole={userRole} />;
}
