"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

const ModuleEditor = dynamic(() => import("./ModuleEditor").then((m) => m.ModuleEditor), {
  ssr: false,
  loading: () => <Skeleton className="h-[60vh] w-full" />,
});

export function ModuleBlocksClient({ moduleId }: { moduleId: string }) {
  return <ModuleEditor moduleId={moduleId} />;
}
