"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Database, CheckCircle2, Loader2 } from "lucide-react";

export function ImportToDraftButton({
  jobId,
  verifiedCount,
  disabled,
}: {
  jobId: string;
  verifiedCount: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (verifiedCount === 0) {
      toast.error("No verified questions ready to move to Draft.");
      return;
    }

    if (!confirm(`Are you sure you want to move all ${verifiedCount} verified question(s) into Question Bank Drafts?`)) {
      return;
    }

    setImporting(true);
    const toastId = toast.loading("Converting verified questions into Question Bank Drafts...");

    try {
      const res = await fetch(`/api/team/question-extract/jobs/${jobId}/import-to-draft`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to import questions.");
      }

      toast.success(`Successfully imported ${json.data?.result?.importedCount || verifiedCount} questions to Question Bank Drafts!`, {
        id: toastId,
      });

      router.push("/team/questions?status=DRAFT");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to import to draft.", { id: toastId });
    } finally {
      setImporting(false);
    }
  };

  return (
    <button
      type="button"
      disabled={disabled || importing}
      onClick={handleImport}
      className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition flex items-center gap-2 active:scale-95"
    >
      {importing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Database className="w-4 h-4" />
      )}
      <span>Move {verifiedCount} Verified to Draft</span>
    </button>
  );
}
