"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DOCUMENT_TYPE_OPTIONS,
  DOCUMENT_TYPE_LABELS,
  type DocumentUploadInput,
} from "@/lib/validation/document";

type ExistingDoc = {
  id: string;
  type: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  rejectionNote: string | null;
  fileName: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  VERIFIED: "bg-tertiary/10 text-tertiary",
  PENDING: "bg-secondary/10 text-secondary",
  REJECTED: "bg-error/10 text-error",
};

export function DocumentUploadForm({ existingDocuments }: { existingDocuments: ExistingDoc[] }) {
  const router = useRouter();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const byType = new Map(existingDocuments.map((d) => [d.type, d]));

  async function handleFile(type: (typeof DOCUMENT_TYPE_OPTIONS)[number], file: File) {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("File too large — please keep it under 4MB.");
      return;
    }
    setUploadingType(type);
    try {
      const fileUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });

      const payload: DocumentUploadInput = { type, fileUrl, fileName: file.name };
      const res = await fetch("/api/team/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Upload failed");
        return;
      }
      toast.success(`${DOCUMENT_TYPE_LABELS[type]} uploaded — pending review`);
      router.refresh();
    } catch {
      toast.error("Something went wrong while uploading.");
    } finally {
      setUploadingType(null);
    }
  }

  return (
    <div className="glass-card rounded-xl divide-y divide-outline-variant/20">
      {DOCUMENT_TYPE_OPTIONS.map((type) => {
        const existing = byType.get(type);
        return (
          <div key={type} className="p-stack-md flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-label-lg text-label-lg text-on-surface">{DOCUMENT_TYPE_LABELS[type]}</div>
              {existing ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-label-sm font-label-sm px-2 py-0.5 rounded-full ${STATUS_STYLES[existing.status]}`}>
                    {existing.status}
                  </span>
                  {existing.fileName && (
                    <span className="text-label-sm text-on-surface-variant truncate">{existing.fileName}</span>
                  )}
                </div>
              ) : (
                <div className="text-label-sm text-on-surface-variant mt-1">Not uploaded yet</div>
              )}
              {existing?.status === "REJECTED" && existing.rejectionNote && (
                <div className="text-label-sm text-error mt-1">Reason: {existing.rejectionNote}</div>
              )}
            </div>

            <div className="shrink-0">
              <input
                ref={(el) => {
                  fileInputRefs.current[type] = el;
                }}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(type, file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={uploadingType === type || existing?.status === "VERIFIED"}
                onClick={() => fileInputRefs.current[type]?.click()}
                className="font-label-md text-label-md px-4 py-2 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {uploadingType === type
                  ? "Uploading..."
                  : existing?.status === "VERIFIED"
                    ? "Verified"
                    : existing
                      ? "Re-upload"
                      : "Upload"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
