"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DOCUMENT_TYPE_LABELS } from "@/lib/validation/document";

type Doc = {
  id: string;
  type: keyof typeof DOCUMENT_TYPE_LABELS;
  fileUrl: string;
  fileName: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  rejectionNote: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  VERIFIED: "bg-tertiary/10 text-tertiary",
  PENDING: "bg-secondary/10 text-secondary",
  REJECTED: "bg-error/10 text-error",
};

export function DocumentVerificationPanel({ documents }: { documents: Doc[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function decide(id: string, status: "VERIFIED" | "REJECTED", rejectionNote?: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/team/documents/${id}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionNote }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not update document");
        return;
      }
      toast.success(status === "VERIFIED" ? "Document verified" : "Document rejected");
      setRejectingId(null);
      setNote("");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  if (documents.length === 0) {
    return <p className="text-on-surface-variant font-body-md">No documents submitted yet.</p>;
  }

  return (
    <div className="glass-card rounded-xl divide-y divide-outline-variant/20">
      {documents.map((doc) => (
        <div key={doc.id} className="p-stack-md space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-label-lg text-label-lg text-on-surface">{DOCUMENT_TYPE_LABELS[doc.type]}</div>
              <span className={`text-label-sm font-label-sm px-2 py-0.5 rounded-full inline-block mt-1 ${STATUS_STYLES[doc.status]}`}>
                {doc.status}
              </span>
            </div>
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="font-label-md text-label-md text-primary hover:underline shrink-0"
            >
              View file
            </a>
          </div>

          {doc.status === "PENDING" && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={busyId === doc.id}
                onClick={() => decide(doc.id, "VERIFIED")}
                className="font-label-md text-label-md px-3 py-1.5 rounded-lg bg-tertiary/10 text-tertiary hover:bg-tertiary/20 transition-colors disabled:opacity-50"
              >
                Verify
              </button>
              {rejectingId === doc.id ? (
                <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                  <input
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Reason for rejection"
                    className="flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest py-1.5 px-2 text-body-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    disabled={busyId === doc.id || !note.trim()}
                    onClick={() => decide(doc.id, "REJECTED", note.trim())}
                    className="font-label-md text-label-md px-3 py-1.5 rounded-lg bg-error text-on-error hover:opacity-90 transition-colors disabled:opacity-50"
                  >
                    Confirm
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setRejectingId(doc.id)}
                  className="font-label-md text-label-md px-3 py-1.5 rounded-lg bg-error/10 text-error hover:bg-error/20 transition-colors"
                >
                  Reject
                </button>
              )}
            </div>
          )}

          {doc.status === "REJECTED" && doc.rejectionNote && (
            <p className="text-label-sm text-error">Reason: {doc.rejectionNote}</p>
          )}
        </div>
      ))}
    </div>
  );
}
