"use client";

import dynamic from "next/dynamic";

const ModuleDesignStudio = dynamic(() => import("./ModuleDesignStudio").then((m) => m.ModuleDesignStudio), {
  ssr: false,
  loading: () => <div className="p-6 text-on-surface-variant">Opening the design studio…</div>,
});

export function ModuleDesignClient({ moduleId }: { moduleId: string }) {
  return <ModuleDesignStudio moduleId={moduleId} />;
}
