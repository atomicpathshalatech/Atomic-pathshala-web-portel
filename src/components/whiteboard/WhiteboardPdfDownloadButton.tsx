"use client";

import { useState } from "react";

/**
 * The slides route (`/api/whiteboard/sessions/[id]/slides?format=pdf`) normally
 * returns JSON with a presigned R2 downloadUrl (not the PDF bytes directly), and
 * only falls back to streaming raw PDF bytes if the R2 presign itself fails. A
 * plain <a href> pointed at this route can't handle either case correctly, so
 * this button fetches it and branches on the actual response instead.
 */
export function WhiteboardPdfDownloadButton({
  sessionId,
  className,
  title,
  children,
}: {
  sessionId: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/whiteboard/sessions/${sessionId}/slides?format=pdf`);
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/pdf")) {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        return;
      }

      const json = await res.json();
      if (json.success && json.data?.downloadUrl) {
        window.open(json.data.downloadUrl, "_blank");
      } else {
        alert(json.error || "Could not download whiteboard PDF notes.");
      }
    } catch {
      alert("Download request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={loading} className={className} title={title}>
      {children}
    </button>
  );
}
