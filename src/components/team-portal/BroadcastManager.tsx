"use client";

import { useState } from "react";
import { toast } from "sonner";

type Batch = { id: string; name: string; code: string };

type Broadcast = {
  id: string;
  title: string;
  body: string;
  segmentType: "ALL" | "BATCH" | "CLASS" | "TARGET_EXAM";
  segmentValue: string | null;
  recipientCount: number;
  sentByName: string;
  createdAt: string;
};

const CLASS_OPTIONS = ["Class 9", "Class 10", "Class 11", "Class 12", "Dropper"];
const TARGET_EXAM_OPTIONS = ["NEET", "JEE Main", "JEE Advanced", "Foundation"];

const SEGMENT_LABEL: Record<Broadcast["segmentType"], string> = {
  ALL: "Everyone",
  BATCH: "Batch",
  CLASS: "Class",
  TARGET_EXAM: "Target Exam",
};

export function BroadcastManager({
  canSend,
  batches,
  initialBroadcasts,
}: {
  canSend: boolean;
  batches: Batch[];
  initialBroadcasts: Broadcast[];
}) {
  const [broadcasts, setBroadcasts] = useState(initialBroadcasts);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [segmentType, setSegmentType] = useState<Broadcast["segmentType"]>("ALL");
  const [segmentValue, setSegmentValue] = useState("");
  const [channel, setChannel] = useState<"IN_APP" | "WHATSAPP" | "EMAIL" | "ALL_CHANNELS">("ALL_CHANNELS");

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/team/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          segmentType,
          channel,
          ...(segmentType === "ALL" ? {} : { segmentValue }),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not send this broadcast.");
        return;
      }
      setBroadcasts((prev) => [
        {
          id: json.data.broadcast.id,
          title,
          body,
          segmentType,
          segmentValue: segmentType === "ALL" ? null : segmentValue,
          recipientCount: json.data.recipientCount,
          sentByName: "You",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      toast.success(
        `Dispatched via ${channel} to ${json.data.recipientCount} student${json.data.recipientCount === 1 ? "" : "s"}`
      );
      setShowForm(false);
      setTitle("");
      setBody("");
      setSegmentType("ALL");
      setSegmentValue("");
      setChannel("ALL_CHANNELS");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-stack-lg">
      {canSend && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-label-md shadow-lg hover:shadow-primary/20 transition-all"
          >
            <span className="material-symbols-outlined">campaign</span>
            New Multi-Channel Broadcast
          </button>
        </div>
      )}

      {canSend && showForm && (
        <form onSubmit={sendBroadcast} className="glass-card rounded-2xl p-6 space-y-4">
          {error && <p className="text-label-sm text-error bg-error/10 rounded-lg py-2 px-3">{error}</p>}

          <div className="space-y-1.5">
            <label className="font-label-md text-label-md text-on-surface">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Special Doubt Clearing Session Tomorrow"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-label-md text-label-md text-on-surface">Message Body</label>
            <textarea
              required
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter announcement details..."
              className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface">Target Audience</label>
              <select
                value={segmentType}
                onChange={(e) => {
                  setSegmentType(e.target.value as Broadcast["segmentType"]);
                  setSegmentValue("");
                }}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="ALL">All Students</option>
                <option value="BATCH">Specific Batch</option>
                <option value="CLASS">Specific Class</option>
                <option value="TARGET_EXAM">Specific Target Exam</option>
              </select>
            </div>

            {segmentType === "BATCH" && (
              <div className="space-y-1.5">
                <label className="font-label-md text-label-md text-on-surface">Batch</label>
                <select
                  required
                  value={segmentValue}
                  onChange={(e) => setSegmentValue(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="" disabled>
                    Choose a batch
                  </option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {segmentType === "CLASS" && (
              <div className="space-y-1.5">
                <label className="font-label-md text-label-md text-on-surface">Class</label>
                <select
                  required
                  value={segmentValue}
                  onChange={(e) => setSegmentValue(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="" disabled>
                    Choose a class
                  </option>
                  {CLASS_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {segmentType === "TARGET_EXAM" && (
              <div className="space-y-1.5">
                <label className="font-label-md text-label-md text-on-surface">Target Exam</label>
                <select
                  required
                  value={segmentValue}
                  onChange={(e) => setSegmentValue(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="" disabled>
                    Choose a target exam
                  </option>
                  {TARGET_EXAM_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface">Dispatch Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as any)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary font-semibold text-primary"
              >
                <option value="ALL_CHANNELS">⚡ All Channels (In-App + WhatsApp + Email)</option>
                <option value="WHATSAPP">💬 WhatsApp Only</option>
                <option value="IN_APP">🔔 In-App Notification Only</option>
                <option value="EMAIL">📧 Email Only</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary-container/10 border border-primary/20 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-primary text-base">verified_user</span>
            <span>
              Real-time multi-channel delivery configured with automatic fallback and audit logging.
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-60 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">send</span>
            {submitting ? "Dispatching..." : "Send Broadcast"}
          </button>
        </form>
      )}

      {broadcasts.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No broadcasts sent yet.
        </div>
      ) : (
        <div className="glass-card rounded-2xl divide-y divide-outline-variant/20">
          {broadcasts.map((b) => (
            <div key={b.id} className="p-5 space-y-1">
              <div className="flex items-center justify-between gap-4">
                <p className="font-label-lg text-label-lg text-on-surface font-semibold">{b.title}</p>
                <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0">
                  {b.recipientCount} recipient{b.recipientCount === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-label-sm text-on-surface-variant">{b.body}</p>
              <p className="text-xs text-on-surface-variant mt-1">
                {SEGMENT_LABEL[b.segmentType]}
                {b.segmentType === "BATCH" && b.segmentValue
                  ? ` — ${batches.find((bt) => bt.id === b.segmentValue)?.name ?? b.segmentValue}`
                  : b.segmentValue
                    ? ` — ${b.segmentValue}`
                    : ""}
                {" · "}
                {b.sentByName} ·{" "}
                {new Date(b.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
