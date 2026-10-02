"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function DppStatusActions({ dppId, status }: { dppId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isPublished = status === "PUBLISHED";

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/dpp/${dppId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isPublished ? "DRAFT" : "PUBLISHED" }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not update status");
        return;
      }
      toast.success(isPublished ? "Unpublished" : "Published");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      disabled={loading}
      onClick={toggle}
      className={`h-8 px-2.5 rounded-lg text-[11px] font-semibold transition disabled:opacity-50 ${
        isPublished
          ? "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300"
      }`}
      title={isPublished ? "Unpublish" : "Publish"}
    >
      {loading ? "…" : isPublished ? "Unpublish" : "Publish"}
    </button>
  );
}
